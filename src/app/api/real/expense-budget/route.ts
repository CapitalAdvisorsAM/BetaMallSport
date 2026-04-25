export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/real/api-params";
import { resolveMonthRange, toPeriodKey } from "@/lib/real/period-range";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ExpenseBudgetResponseRow = {
  periodo: string;
  grupo1: string;
  grupo3: string;
  valorUf: string;
};

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

    const rows = await prisma.expenseBudget.findMany({
      where: {
        projectId,
        periodo: { gte: desdeDate, lte: hastaDate }
      },
      orderBy: [{ periodo: "asc" }, { grupo1: "asc" }, { grupo3: "asc" }],
      select: {
        periodo: true,
        grupo1: true,
        grupo3: true,
        valorUf: true
      }
    });

    const data: ExpenseBudgetResponseRow[] = rows.map((row) => ({
      periodo: toPeriodKey(row.periodo),
      grupo1: row.grupo1,
      grupo3: row.grupo3,
      valorUf: row.valorUf.toString()
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
