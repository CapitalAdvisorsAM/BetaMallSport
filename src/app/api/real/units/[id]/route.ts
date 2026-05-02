export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { AccountingScenario } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/real/api-params";
import { resolveMonthRange, toPeriodKey } from "@/lib/real/period-range";
import { legacyDiscountFields } from "@/lib/contracts/rate-history";
import { attributeSalesToLocal, buildLocal360Data } from "@/lib/real/local-360";
import type {
  RawContractWithTenant,
  RawTenantContractFootprint,
  RawPeerUnitStat,
} from "@/lib/real/local-360";
import { buildUfRateMap } from "@/lib/real/uf-lookup";
import { shiftPeriod, toNum } from "@/lib/real/billing-utils";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const unitId = params.id;
    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);

    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(from, to);

    // Phase 1: unit + contracts that ever included this local
    const [unit, contracts] = await Promise.all([
      prisma.unit.findFirst({
        where: { id: unitId, projectId },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          glam2: true,
          piso: true,
          tipo: true,
          zonaId: true,
          categoriaTamano: true,
          esGLA: true,
          estado: true,
          zona: { select: { nombre: true } },
        },
      }),
      prisma.contract.findMany({
        where: {
          projectId,
          OR: [
            { localId: unitId },
            { locales: { some: { localId: unitId } } },
          ],
        },
        include: {
          arrendatario: {
            select: { id: true, rut: true, razonSocial: true, nombreComercial: true },
          },
          local: {
            select: { id: true, codigo: true, nombre: true, glam2: true, esGLA: true },
          },
          tarifas: {
            where: { supersededAt: null },
            include: {
              discounts: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "asc" } },
            },
            orderBy: { vigenciaDesde: "asc" },
          },
          ggcc: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "desc" } },
          anexos: { orderBy: { fecha: "desc" } },
        },
        orderBy: { fechaInicio: "asc" },
      }),
    ]);

    if (!unit) {
      throw new ApiError(404, "Local no encontrado.");
    }

    const tenantIds = [...new Set(contracts.map((c) => c.arrendatarioId))];
    const contractIds = contracts.map((c) => c.id);

    // Phase 2: parallel data fetch
    const lagFromDate = new Date(
      Date.UTC(desdeDate.getUTCFullYear(), desdeDate.getUTCMonth() - VARIABLE_RENT_LAG_MONTHS, 1),
    );

    const [
      accountingRecords,
      rawSales,
      contractDays,
      energyEntries,
      tenantFootprintRows,
      latestUf,
    ] = await Promise.all([
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          unitId,
          period: { gte: desdeDate, lte: hastaDate },
          scenario: AccountingScenario.REAL,
        },
        select: {
          unitId: true,
          period: true,
          group1: true,
          group3: true,
          denomination: true,
          valueUf: true,
        },
        orderBy: [{ group1: "asc" }, { group3: "asc" }, { period: "asc" }],
      }),
      tenantIds.length > 0
        ? prisma.tenantSale.findMany({
            where: {
              projectId,
              tenantId: { in: tenantIds },
              period: { gte: lagFromDate, lte: hastaDate },
            },
            select: { tenantId: true, period: true, salesPesos: true },
            orderBy: { period: "asc" },
          })
        : [],
      contractIds.length > 0
        ? prisma.contractDay.findMany({
            where: {
              projectId,
              localId: unitId,
              fecha: { gte: desdeDate, lte: hastaDate },
            },
            select: {
              localId: true,
              fecha: true,
              estadoDia: true,
              glam2: true,
              local: { select: { codigo: true } },
            },
            orderBy: { fecha: "asc" },
          })
        : [],
      prisma.ingresoEnergia.findMany({
        where: {
          projectId,
          localId: unitId,
          periodo: { gte: desdeDate, lte: hastaDate },
        },
        select: { periodo: true, valorUf: true },
        orderBy: { periodo: "asc" },
      }),
      tenantIds.length > 0
        ? prisma.contract.findMany({
            where: {
              projectId,
              arrendatarioId: { in: tenantIds },
              fechaInicio: { lte: hastaDate },
              fechaTermino: { gte: lagFromDate },
            },
            select: {
              arrendatarioId: true,
              localId: true,
              fechaInicio: true,
              fechaTermino: true,
              local: { select: { glam2: true } },
            },
          })
        : [],
      prisma.valorUF.findFirst({ orderBy: { fecha: "desc" } }),
    ]);

    // Build period grid
    const allPeriods = new Set<string>();
    let cursor = new Date(desdeDate);
    while (cursor <= hastaDate) {
      allPeriods.add(toPeriodKey(cursor));
      cursor = new Date(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
    }
    const periods = [...allPeriods].sort();

    // Sales attribution to this single local
    const tenantFootprints: RawTenantContractFootprint[] = tenantFootprintRows.map((c) => ({
      arrendatarioId: c.arrendatarioId,
      localId: c.localId,
      fechaInicio: c.fechaInicio,
      fechaTermino: c.fechaTermino,
      glam2: c.local.glam2,
    }));

    const lagPeriods = periods.map((p) => shiftPeriod(p, -VARIABLE_RENT_LAG_MONTHS));
    const allRelevantPeriods = [...new Set([...periods, ...lagPeriods])].sort();
    const ufRateByPeriod = await buildUfRateMap(allRelevantPeriods);

    const attributedSales = attributeSalesToLocal({
      thisUnitId: unitId,
      thisGlam2: toNum(unit.glam2),
      tenantFootprints,
      rawSales,
      periods: allRelevantPeriods,
    });

    // Peer comparison: same project, same tipo OR same zonaId (excl. this unit)
    const peerWhere = {
      projectId,
      estado: "ACTIVO" as const,
      id: { not: unitId },
      ...(unit.zonaId
        ? { OR: [{ zonaId: unit.zonaId }, { tipo: unit.tipo }] }
        : { tipo: unit.tipo }),
    };

    const peerUnits = await prisma.unit.findMany({
      where: peerWhere,
      select: { id: true, codigo: true, glam2: true },
    });

    let peerStats: RawPeerUnitStat[] = [];
    if (peerUnits.length > 0) {
      const peerUnitIds = peerUnits.map((p) => p.id);
      const peerRecords = await prisma.accountingRecord.findMany({
        where: {
          projectId,
          unitId: { in: peerUnitIds },
          period: { gte: desdeDate, lte: hastaDate },
          scenario: AccountingScenario.REAL,
          group1: "INGRESOS DE EXPLOTACION",
        },
        select: { unitId: true, valueUf: true },
      });
      const billingByUnit = new Map<string, number>();
      for (const r of peerRecords) {
        if (!r.unitId) continue;
        billingByUnit.set(r.unitId, (billingByUnit.get(r.unitId) ?? 0) + toNum(r.valueUf));
      }
      peerStats = peerUnits.map((p) => ({
        unitId: p.id,
        codigo: p.codigo,
        glam2: p.glam2,
        totalBillingUf: billingByUnit.get(p.id) ?? 0,
      }));
    }

    // Project active discounts back into the legacy 4-field shape so billing
    // calculations actually apply them.
    const contractsWithDiscounts: RawContractWithTenant[] = contracts.map((c) => ({
      ...c,
      tarifas: c.tarifas.map(({ discounts, ...t }) => {
        const proj = legacyDiscountFields(discounts);
        return {
          ...t,
          descuentoTipo: proj.descuentoTipo,
          descuentoValor: proj.descuentoValor,
          descuentoDesde: proj.descuentoDesde ? new Date(proj.descuentoDesde) : null,
          descuentoHasta: proj.descuentoHasta ? new Date(proj.descuentoHasta) : null,
        };
      }),
    }));

    const data = buildLocal360Data({
      unit,
      contracts: contractsWithDiscounts,
      accountingRecords,
      attributedSales,
      contractDays,
      energyEntries,
      peerStats,
      latestUf,
      periods,
      ufRateByPeriod,
      rangeFromDate: desdeDate,
      rangeToDate: hastaDate,
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
