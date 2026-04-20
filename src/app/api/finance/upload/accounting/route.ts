import { DataUploadType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { parseContable } from "@/lib/finance/parse-accounting";
import { similarity } from "@/lib/finance/parse-utils";
import { getFormFieldValue } from "@/lib/finance/api-params";
import { recalculateBillingAlerts } from "@/lib/finance/billing-alerts";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";

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

    if (rows.length === 0) throw new ApiError(400, "No se encontraron filas con Ce.coste = 'Real'.");

    const units = await prisma.unit.findMany({
      where: { proyectoId: projectId },
      select: { id: true, codigo: true, nombre: true }
    });
    const existingMappings = await prisma.accountingUnitMapping.findMany({
      where: { projectId },
      select: { externalUnit: true, unitId: true }
    });
    const unitMappingByExternal = new Map(existingMappings.map((m) => [m.externalUnit, m.unitId]));

    const uniqueExternalUnits = [...new Set(rows.map((row) => row.localCodigo))];
    const unmapped: Array<{
      localCodigo: string;
      arrendatarioNombre: string;
      sugerencias: Array<{ codigo: string; nombre: string; score: number }>;
    }> = [];
    const newMappings: Array<{
      projectId: string;
      externalUnit: string;
      unitId: string;
      createdBy: string;
    }> = [];

    for (const externalUnit of uniqueExternalUnits) {
      if (unitMappingByExternal.has(externalUnit)) continue;

      const exactMatch = units.find((unit) => unit.codigo === externalUnit || unit.codigo === `L${externalUnit}`);
      if (exactMatch) {
        unitMappingByExternal.set(externalUnit, exactMatch.id);
        newMappings.push({
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
            score: Math.max(similarity(tenantNameInRow, unit.nombre), similarity(tenantNameInRow, unit.codigo))
          }))
          .sort((a, b) => b.score - a.score);

        if (scored[0] && scored[0].score >= 0.75) {
          unitMappingByExternal.set(externalUnit, scored[0].id);
          newMappings.push({
            projectId,
            externalUnit,
            unitId: scored[0].id,
            createdBy: session.user.id
          });
          continue;
        }

        unmapped.push({
          localCodigo: externalUnit,
          arrendatarioNombre: tenantNameInRow,
          sugerencias: scored.slice(0, 3).map((unit) => ({
            codigo: unit.codigo,
            nombre: unit.nombre,
            score: unit.score
          }))
        });
      } else {
        unmapped.push({ localCodigo: externalUnit, arrendatarioNombre: "", sugerencias: [] });
      }
    }

    if (newMappings.length > 0) {
      await prisma.accountingUnitMapping.createMany({ data: newMappings, skipDuplicates: true });
    }

    const contractsByUnit = await prisma.contract.findMany({
      where: { proyectoId: projectId, estado: { in: ["VIGENTE", "GRACIA"] } },
      select: { localId: true, arrendatarioId: true }
    });
    const tenantByUnitId = new Map(contractsByUnit.map((contract) => [contract.localId, contract.arrendatarioId]));

    const periods = [...new Set(rows.map((row) => row.mes.toISOString().slice(0, 7)))];
    const records: Array<{
      projectId: string;
      unitId: string;
      tenantId: string | null;
      period: Date;
      group1: string;
      group3: string;
      denomination: string;
      valueUf: number;
      sizeCategory: string | null;
      typeCategory: string | null;
      floor: string | null;
    }> = [];

    for (const row of rows) {
      const unitId = unitMappingByExternal.get(row.localCodigo);
      if (!unitId) continue;
      const tenantId = tenantByUnitId.get(unitId) ?? null;

      records.push({
        projectId,
        unitId,
        tenantId,
        period: row.mes,
        group1: row.grupo1,
        group3: row.grupo3,
        denomination: row.denominacion || row.grupo3,
        valueUf: row.valorUf,
        sizeCategory: row.categoriaTamano || null,
        typeCategory: row.categoriaTipo || null,
        floor: row.piso || null
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
        errorDetail: unmapped.length > 0 ? ({ sinMapeo: unmapped } as object) : undefined
      }
    });
    invalidateMetricsCacheByProject(projectId);

    // Recalculate billing alerts in the background (fire-and-forget)
    void recalculateBillingAlerts(projectId);

    return NextResponse.json({
      periods,
      periodos: periods,
      totalFilas: rows.length,
      recordsInserted: inserted,
      registrosInsertados: inserted,
      automaticMatches: newMappings.length,
      matchesAutomaticos: newMappings.length,
      sinMapeo: unmapped
    });
  } catch (error) {
    return handleApiError(error);
  }
}
