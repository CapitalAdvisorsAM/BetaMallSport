export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/real/api-params";
import { buildCashFlow } from "@/lib/real/cash-flow";
import { resolveMonthRange } from "@/lib/real/period-range";
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

    const [rawMovements, rawFondos] = await Promise.all([
      prisma.bankMovement.findMany({
        where: { projectId, period: { gte: desdeDate, lte: hastaDate } },
        orderBy: [{ period: "asc" }, { classification: "asc" }],
        select: { period: true, classification: true, amountClp: true, bank: true }
      }),
      prisma.balanceRecord.findMany({
        where: {
          projectId,
          period: { gte: desdeDate, lte: hastaDate },
          category: { contains: "Fondo", mode: "insensitive" }
        },
        select: { period: true, assetClp: true }
      })
    ]);

    return NextResponse.json(
      buildCashFlow(
        rawMovements.map((r) => ({
          period: r.period,
          classification: r.classification,
          amountClp: r.amountClp,
          bank: r.bank
        })),
        rawFondos.map((r) => ({ period: r.period, balanceClp: r.assetClp }))
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
