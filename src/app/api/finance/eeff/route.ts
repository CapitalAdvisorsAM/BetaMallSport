export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceFrom, getFinanceProjectId, getFinanceTo } from "@/lib/finance/api-params";
import { buildEeff } from "@/lib/finance/eeff";
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
    const records = await prisma.balanceRecord.findMany({
      where: {
        projectId,
        period: { gte: desdeDate, lte: hastaDate }
      },
      orderBy: [{ period: "asc" }, { groupName: "asc" }, { accountCode: "asc" }],
      select: {
        period: true,
        groupName: true,
        category: true,
        accountCode: true,
        accountName: true,
        valueUf: true
      }
    });

    return NextResponse.json(
      buildEeff(
        records.map((record) => ({
          period: record.period,
          groupName: record.groupName,
          category: record.category,
          accountCode: record.accountCode,
          accountName: record.accountName,
          valueUf: record.valueUf
        }))
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
