export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import { buildCashFlow } from "@/lib/finance/cash-flow";
import { resolveMonthRange } from "@/lib/finance/period-range";
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
    const records = await prisma.bankMovement.findMany({
      where: {
        projectId,
        period: { gte: desdeDate, lte: hastaDate }
      },
      orderBy: [{ period: "asc" }, { classification: "asc" }],
      select: {
        period: true,
        classification: true,
        amountClp: true
      }
    });

    return NextResponse.json(
      buildCashFlow(
        records.map((record) => ({
          period: record.period,
          classification: record.classification,
          amountClp: record.amountClp
        }))
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
