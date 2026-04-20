export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import { buildEerrData } from "@/lib/finance/eerr";
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

    const [records, expenseBudgets] = await Promise.all([
      prisma.accountingRecord.findMany({
        where: {
          projectId,
          period: { gte: desdeDate, lte: hastaDate }
        },
        orderBy: { period: "asc" },
        select: {
          group1: true,
          group3: true,
          period: true,
          valueUf: true
        }
      }),
      prisma.expenseBudget.findMany({
        where: {
          projectId,
          periodo: { gte: desdeDate, lte: hastaDate }
        },
        orderBy: { periodo: "asc" },
        select: {
          grupo1: true,
          grupo3: true,
          periodo: true,
          valorUf: true
        }
      })
    ]);

    const legacyRecords = records.map((record) => ({
      grupo1: record.group1,
      grupo3: record.group3,
      periodo: record.period,
      valorUf: record.valueUf
    }));

    return NextResponse.json(buildEerrData(legacyRecords, { budgets: expenseBudgets }));
  } catch (error) {
    return handleApiError(error);
  }
}
