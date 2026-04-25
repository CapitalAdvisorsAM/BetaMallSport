export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/real/api-params";
import { resolveMonthRange, toPeriodKey } from "@/lib/real/period-range";
import { buildUfRateMap } from "@/lib/real/uf-lookup";
import { shiftPeriod } from "@/lib/real/billing-utils";
import { legacyDiscountFields } from "@/lib/contracts/rate-history";
import { buildBudgetVsActual } from "@/lib/plan/budget-vs-actual";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);

    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const { desdeDate, hastaDate } = resolveMonthRange(from, to);

    const periods: string[] = [];
    const cursor = new Date(desdeDate);
    while (cursor <= hastaDate) {
      periods.push(toPeriodKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const [contracts, accountingRecords, budgetedSales] = await Promise.all([
      prisma.contract.findMany({
        where: {
          projectId: projectId,
          estado: { in: ["VIGENTE", "GRACIA"] },
          fechaInicio: { lte: hastaDate },
          fechaTermino: { gte: desdeDate },
        },
        include: {
          local: {
            select: { id: true, codigo: true, nombre: true, glam2: true },
          },
          arrendatario: {
            select: { id: true, rut: true, nombreComercial: true },
          },
          tarifas: {
            where: { supersededAt: null },
            orderBy: { vigenciaDesde: "desc" },
            select: {
              tipo: true,
              valor: true,
              vigenciaDesde: true,
              vigenciaHasta: true,
              esDiciembre: true,
              discounts: {
                where: { supersededAt: null },
                orderBy: { vigenciaDesde: "asc" },
                select: { tipo: true, valor: true, vigenciaDesde: true, vigenciaHasta: true },
              },
            },
          },
          ggcc: {
            where: { supersededAt: null },
            orderBy: { vigenciaDesde: "desc" },
            select: {
              tarifaBaseUfM2: true,
              pctAdministracion: true,
              vigenciaDesde: true,
              vigenciaHasta: true,
            },
          },
        },
      }),
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          period: { gte: desdeDate, lte: hastaDate },
          group1: "INGRESOS DE EXPLOTACION",
        },
        select: {
          unitId: true,
          period: true,
          group1: true,
          valueUf: true,
        },
      }),
      prisma.tenantBudgetedSale.findMany({
        where: {
          projectId,
          period: {
            gte: new Date(Date.UTC(desdeDate.getUTCFullYear(), desdeDate.getUTCMonth() - VARIABLE_RENT_LAG_MONTHS, 1)),
            lte: hastaDate,
          },
        },
        select: {
          tenantId: true,
          period: true,
          salesPesos: true,
        },
      }),
    ]);

    // Build UF map for all periods and their lag counterparts.
    const lagPeriods = periods.map((p) => shiftPeriod(p, -VARIABLE_RENT_LAG_MONTHS));
    const ufRateByPeriod = await buildUfRateMap([...new Set([...periods, ...lagPeriods])]);
    // Project active discounts back into the legacy 4-field shape so
    // calcExpectedIncome inside buildBudgetVsActual actually applies them.
    const contractsWithDiscounts = contracts.map((c) => ({
      ...c,
      tarifas: c.tarifas.map(({ discounts, ...t }) => {
        const proj = legacyDiscountFields(discounts);
        return {
          ...t,
          descuentoTipo: proj.descuentoTipo,
          descuentoValor: proj.descuentoValor,
          descuentoDesde: proj.descuentoDesde ? new Date(proj.descuentoDesde) : null,
          descuentoHasta: proj.descuentoHasta ? new Date(proj.descuentoHasta) : null
        };
      })
    }));

    const result = buildBudgetVsActual(contractsWithDiscounts, accountingRecords, budgetedSales, periods, ufRateByPeriod);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
