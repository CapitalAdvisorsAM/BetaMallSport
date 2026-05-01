export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { AccountingScenario } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { legacyDiscountFields } from "@/lib/contracts/rate-history";
import { getFinanceMode, getFinancePeriod, getFinanceProjectId } from "@/lib/real/api-params";
import { shiftPeriod } from "@/lib/real/billing-utils";
import { buildUfRateMap, getUfRate } from "@/lib/real/uf-lookup";
import { buildWaterfall, type WfContract } from "@/lib/real/waterfall";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { WaterfallMode } from "@/types/finance";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const periodParam = getFinancePeriod(searchParams);
    const modeParam = getFinanceMode(searchParams);

    if (!projectId) {
      throw new ApiError(400, "projectId requerido.");
    }

    const mode: WaterfallMode = modeParam === "yoy" ? "yoy" : "mom";

    // Default period: current month
    const now = new Date();
    const currentPeriod = periodParam ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const previousPeriod = shiftPeriod(currentPeriod, mode === "yoy" ? -12 : -1);

    const currentDate = new Date(`${currentPeriod}-01`);
    const previousDate = new Date(`${previousPeriod}-01`);

    // For sales lag, we need records going back further
    const salesStartPeriod = shiftPeriod(previousPeriod, -VARIABLE_RENT_LAG_MONTHS);
    const salesStartDate = new Date(`${salesStartPeriod}-01`);

    const [contracts, accountingRecords, sales] = await Promise.all([
      prisma.contract.findMany({
        where: { projectId: projectId },
        include: {
          local: {
            select: { id: true, glam2: true },
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
                select: {
                  tipo: true,
                  valor: true,
                  vigenciaDesde: true,
                  vigenciaHasta: true,
                },
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
          period: { in: [previousDate, currentDate] },
          group1: "INGRESOS DE EXPLOTACION",
          scenario: AccountingScenario.REAL,
        },
        select: {
          unitId: true,
          period: true,
          group1: true,
          valueUf: true,
        },
      }),
      prisma.tenantSale.findMany({
        where: {
          projectId,
          period: { gte: salesStartDate, lte: currentDate },
        },
        select: {
          tenantId: true,
          period: true,
          salesPesos: true,
        },
      }),
    ]);

    // Project active discounts back into the legacy 4-field shape on each tarifa
    // so billing helpers (computeEffectiveRate) can apply them transparently.
    const wfContracts: WfContract[] = contracts.map((c) => ({
      ...c,
      tarifas: c.tarifas.map(({ discounts, ...tarifa }) => {
        const projected = legacyDiscountFields(discounts);
        return {
          ...tarifa,
          descuentoTipo: projected.descuentoTipo,
          descuentoValor: projected.descuentoValor,
          descuentoDesde: projected.descuentoDesde ? new Date(projected.descuentoDesde) : null,
          descuentoHasta: projected.descuentoHasta ? new Date(projected.descuentoHasta) : null,
        };
      }),
    }));

    const ufRateByPeriod = await buildUfRateMap([...new Set(sales.map((sale) => sale.period.toISOString().slice(0, 7)))]);
    const salesInUf = sales.map((sale) => {
      const period = sale.period.toISOString().slice(0, 7);
      const uf = getUfRate(period, ufRateByPeriod);
      return {
        ...sale,
        salesPesos: uf > 0 ? Number(sale.salesPesos) / uf : 0,
      };
    });

    const result = buildWaterfall(
      wfContracts,
      accountingRecords,
      salesInUf,
      currentPeriod,
      previousPeriod,
      mode,
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
