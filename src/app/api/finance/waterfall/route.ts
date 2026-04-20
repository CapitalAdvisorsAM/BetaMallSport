export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { getFinanceMode, getFinancePeriod, getFinanceProjectId } from "@/lib/finance/api-params";
import { shiftPeriod } from "@/lib/finance/billing-utils";
import { buildWaterfall } from "@/lib/finance/waterfall";
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
        where: { proyectoId: projectId },
        include: {
          local: {
            select: { id: true, glam2: true },
          },
          tarifas: {
            orderBy: { vigenciaDesde: "desc" },
            select: {
              tipo: true,
              valor: true,
              vigenciaDesde: true,
              vigenciaHasta: true,
              esDiciembre: true,
            },
          },
          ggcc: {
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

    const result = buildWaterfall(
      contracts,
      accountingRecords,
      sales,
      currentPeriod,
      previousPeriod,
      mode,
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
