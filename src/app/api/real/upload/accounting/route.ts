import { AccountingScenario, DataUploadType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { parseContable } from "@/lib/real/parse-accounting";
import { similarity } from "@/lib/real/parse-utils";
import { getFormFieldValue } from "@/lib/real/api-params";
import { recalculateBillingAlerts } from "@/lib/real/billing-alerts";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UnmappedUnit = {
  localCodigo: string;
  arrendatarioNombre: string;
  sugerencias: Array<{ codigo: string; nombre: string; score: number }>;
};

type UnmappedTenant = {
  arrendatarioExterno: string;
  sugerencias: Array<{ id: string; razonSocial: string; nombreComercial: string; score: number }>;
};

const TENANT_MATCH_THRESHOLD = 0.75;
const UNIT_MATCH_THRESHOLD = 0.75;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = getFormFieldValue(formData, ["projectId", "proyectoId"]);

    if (!file || !projectId) throw new ApiError(400, "Se requiere archivo y projectId.");
    if (file.size > 30 * 1024 * 1024) throw new ApiError(400, "El archivo no puede superar 30 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseContable(buffer);

    if (rows.length === 0) {
      throw new ApiError(
        400,
        "No se encontraron filas con Ce.coste = 'Real' o 'Ppto' en la hoja Data Contable/Maestro."
      );
    }

    const [units, tenants, existingUnitMappings, existingTenantMappings] = await Promise.all([
      prisma.unit.findMany({
        where: { projectId },
        select: { id: true, codigo: true, nombre: true }
      }),
      prisma.tenant.findMany({
        where: { projectId },
        select: { id: true, razonSocial: true, nombreComercial: true }
      }),
      prisma.accountingUnitMapping.findMany({
        where: { projectId },
        select: { externalUnit: true, unitId: true }
      }),
      prisma.accountingTenantMapping.findMany({
        where: { projectId },
        select: { externalTenant: true, tenantId: true }
      })
    ]);

    const unitByExternal = new Map(existingUnitMappings.map((m) => [m.externalUnit, m.unitId]));
    const tenantByExternal = new Map(
      existingTenantMappings.map((m) => [m.externalTenant, m.tenantId])
    );

    const unmappedUnits: UnmappedUnit[] = [];
    const newUnitMappings: Array<{
      projectId: string;
      externalUnit: string;
      unitId: string;
      createdBy: string;
    }> = [];

    for (const externalUnit of new Set(rows.map((row) => row.localCodigo))) {
      if (!externalUnit) continue; // filas sin Local en el Excel se persisten con unitId null
      if (unitByExternal.has(externalUnit)) continue;

      const exactMatch = units.find(
        (unit) => unit.codigo === externalUnit || unit.codigo === `L${externalUnit}`
      );
      if (exactMatch) {
        unitByExternal.set(externalUnit, exactMatch.id);
        newUnitMappings.push({
          projectId,
          externalUnit,
          unitId: exactMatch.id,
          createdBy: session.user.id
        });
        continue;
      }

      const tenantNameInRow = rows.find((row) => row.localCodigo === externalUnit)?.arrendatarioNombre ?? "";
      if (tenantNameInRow) {
        const scored = units
          .map((unit) => ({
            ...unit,
            score: Math.max(
              similarity(tenantNameInRow, unit.nombre),
              similarity(tenantNameInRow, unit.codigo)
            )
          }))
          .sort((a, b) => b.score - a.score);

        if (scored[0] && scored[0].score >= UNIT_MATCH_THRESHOLD) {
          unitByExternal.set(externalUnit, scored[0].id);
          newUnitMappings.push({
            projectId,
            externalUnit,
            unitId: scored[0].id,
            createdBy: session.user.id
          });
          continue;
        }

        unmappedUnits.push({
          localCodigo: externalUnit,
          arrendatarioNombre: tenantNameInRow,
          sugerencias: scored.slice(0, 3).map((unit) => ({
            codigo: unit.codigo,
            nombre: unit.nombre,
            score: unit.score
          }))
        });
      } else {
        unmappedUnits.push({ localCodigo: externalUnit, arrendatarioNombre: "", sugerencias: [] });
      }
    }

    if (newUnitMappings.length > 0) {
      await prisma.accountingUnitMapping.createMany({
        data: newUnitMappings,
        skipDuplicates: true
      });
    }

    const unmappedTenants: UnmappedTenant[] = [];
    const newTenantMappings: Array<{
      projectId: string;
      externalTenant: string;
      tenantId: string;
      createdBy: string;
    }> = [];

    for (const externalTenant of new Set(
      rows.map((row) => row.arrendatarioNombre).filter((name) => name.length > 0)
    )) {
      if (tenantByExternal.has(externalTenant)) continue;

      const exactMatch = tenants.find(
        (tenant) =>
          tenant.nombreComercial.trim().toUpperCase() === externalTenant.trim().toUpperCase() ||
          tenant.razonSocial.trim().toUpperCase() === externalTenant.trim().toUpperCase()
      );
      if (exactMatch) {
        tenantByExternal.set(externalTenant, exactMatch.id);
        newTenantMappings.push({
          projectId,
          externalTenant,
          tenantId: exactMatch.id,
          createdBy: session.user.id
        });
        continue;
      }

      const scored = tenants
        .map((tenant) => ({
          ...tenant,
          score: Math.max(
            similarity(externalTenant, tenant.nombreComercial),
            similarity(externalTenant, tenant.razonSocial)
          )
        }))
        .sort((a, b) => b.score - a.score);

      if (scored[0] && scored[0].score >= TENANT_MATCH_THRESHOLD) {
        tenantByExternal.set(externalTenant, scored[0].id);
        newTenantMappings.push({
          projectId,
          externalTenant,
          tenantId: scored[0].id,
          createdBy: session.user.id
        });
        continue;
      }

      unmappedTenants.push({
        arrendatarioExterno: externalTenant,
        sugerencias: scored.slice(0, 3).map((tenant) => ({
          id: tenant.id,
          razonSocial: tenant.razonSocial,
          nombreComercial: tenant.nombreComercial,
          score: tenant.score
        }))
      });
    }

    if (newTenantMappings.length > 0) {
      await prisma.accountingTenantMapping.createMany({
        data: newTenantMappings,
        skipDuplicates: true
      });
    }

    const periods = [...new Set(rows.map((row) => row.mes.toISOString().slice(0, 7)))];

    const chartKey = (g0: string, g1: string, g2: string, g3: string) =>
      `${g0}${g1}${g2}${g3}`;

    const uniqueChartTuples = new Map<string, { g0: string; g1: string; g2: string; g3: string }>();
    for (const row of rows) {
      if (!row.grupo1 || !row.grupo3) continue;
      const k = chartKey(row.grupo0, row.grupo1, row.grupo2, row.grupo3);
      if (!uniqueChartTuples.has(k)) {
        uniqueChartTuples.set(k, { g0: row.grupo0, g1: row.grupo1, g2: row.grupo2, g3: row.grupo3 });
      }
    }

    const existingChartAccounts = await prisma.chartOfAccount.findMany({
      where: {
        projectId,
        OR: [...uniqueChartTuples.values()].map((t) => ({
          group0: t.g0,
          group1: t.g1,
          group2: t.g2,
          group3: t.g3
        }))
      },
      select: { id: true, group0: true, group1: true, group2: true, group3: true }
    });

    const chartIdByKey = new Map<string, string>();
    for (const account of existingChartAccounts) {
      chartIdByKey.set(chartKey(account.group0, account.group1, account.group2, account.group3), account.id);
    }

    const newChartAccounts: Prisma.ChartOfAccountCreateManyInput[] = [];
    for (const [key, t] of uniqueChartTuples) {
      if (chartIdByKey.has(key)) continue;
      newChartAccounts.push({
        projectId,
        group0: t.g0,
        group1: t.g1,
        group2: t.g2,
        group3: t.g3
      });
    }

    if (newChartAccounts.length > 0) {
      await prisma.chartOfAccount.createMany({ data: newChartAccounts, skipDuplicates: true });
      const refreshed = await prisma.chartOfAccount.findMany({
        where: {
          projectId,
          OR: newChartAccounts.map((c) => ({
            group0: c.group0 ?? "",
            group1: c.group1,
            group2: c.group2 ?? "",
            group3: c.group3
          }))
        },
        select: { id: true, group0: true, group1: true, group2: true, group3: true }
      });
      for (const account of refreshed) {
        chartIdByKey.set(
          chartKey(account.group0, account.group1, account.group2, account.group3),
          account.id
        );
      }
    }

    const records: Prisma.AccountingRecordCreateManyInput[] = [];
    let recordsWithoutUnit = 0;
    let recordsWithoutTenant = 0;
    let realRows = 0;
    let pptoRows = 0;

    for (const row of rows) {
      const unitId = row.localCodigo ? unitByExternal.get(row.localCodigo) ?? null : null;
      const tenantId = row.arrendatarioNombre
        ? tenantByExternal.get(row.arrendatarioNombre) ?? null
        : null;
      const chartOfAccountId =
        row.grupo1 && row.grupo3
          ? chartIdByKey.get(chartKey(row.grupo0, row.grupo1, row.grupo2, row.grupo3)) ?? null
          : null;

      if (unitId === null) recordsWithoutUnit += 1;
      if (tenantId === null) recordsWithoutTenant += 1;
      if (row.scenario === AccountingScenario.REAL) realRows += 1;
      else pptoRows += 1;

      records.push({
        projectId,
        unitId,
        tenantId,
        chartOfAccountId,
        externalUnit: row.localCodigo || null,
        externalTenant: row.arrendatarioNombre || null,
        period: row.mes,
        group0: row.grupo0 || null,
        group1: row.grupo1,
        group2: row.grupo2 || null,
        group3: row.grupo3,
        denomination: row.denominacion || row.grupo3,
        costCenterCode: row.clCoste || null,
        costCenterDescription: row.descripcionClCoste || null,
        valueUf: new Prisma.Decimal(row.valorUf),
        valueClp: row.valorClp ? new Prisma.Decimal(row.valorClp) : null,
        sizeCategory: row.categoriaTamano || null,
        typeCategory: row.categoriaTipo || null,
        floor: row.piso || null,
        documentRef: row.documento || null,
        documentHeader: row.textoCabDocumento || null,
        glaFlag: row.esGla,
        scenario: row.scenario
      });
    }

    let inserted = 0;
    if (records.length > 0) {
      for (const period of periods) {
        await prisma.accountingRecord.deleteMany({
          where: { projectId, period: new Date(`${period}-01`) }
        });
      }
      const result = await prisma.accountingRecord.createMany({ data: records, skipDuplicates: true });
      inserted = result.count;
    }

    await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.ACCOUNTING,
        userId: session.user.id,
        fileName: file.name,
        fileUrl: "",
        recordsLoaded: inserted,
        status: "OK",
        errorDetail:
          unmappedUnits.length > 0 || unmappedTenants.length > 0
            ? ({ sinMapeo: unmappedUnits, arrendatariosSinMapeo: unmappedTenants } as object)
            : undefined
      }
    });
    invalidateMetricsCacheByProject(projectId);

    void recalculateBillingAlerts(projectId);

    return NextResponse.json({
      periods,
      periodos: periods,
      totalFilas: rows.length,
      recordsInserted: inserted,
      registrosInsertados: inserted,
      recordsRealInsertados: realRows,
      recordsPptoInsertados: pptoRows,
      recordsWithoutUnit,
      recordsWithoutTenant,
      automaticMatches: newUnitMappings.length,
      matchesAutomaticos: newUnitMappings.length,
      tenantMatchesAutomaticos: newTenantMappings.length,
      sinMapeo: unmappedUnits,
      arrendatariosSinMapeo: unmappedTenants
    });
  } catch (error) {
    return handleApiError(error);
  }
}
