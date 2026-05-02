import { AccountingScenario } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import {
  getFinanceFrom,
  getFinancePeriod,
  getFinanceProjectId,
  getFinanceTenantId,
  getFinanceTo
} from "@/lib/real/api-params";
import { resolveMonthRange } from "@/lib/real/period-range";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const tenantId = getFinanceTenantId(searchParams);
    const period = getFinancePeriod(searchParams);
    const from = getFinanceFrom(searchParams);
    const to = getFinanceTo(searchParams);

    if (!projectId || !tenantId) {
      throw new ApiError(400, "projectId y tenantId son requeridos.");
    }

    if (period) {
      const periodDate = new Date(`${period}-01`);
      const records = await prisma.accountingRecord.findMany({
        where: {
          projectId,
          tenantId,
          period: periodDate,
          scenario: AccountingScenario.REAL
        },
        select: {
          group1: true,
          group3: true,
          denomination: true,
          valueUf: true
        },
        orderBy: [{ group1: "asc" }, { group3: "asc" }, { denomination: "asc" }]
      });

      const entries = records.map((record) => ({
        group1: record.group1,
        group3: record.group3,
        denomination: record.denomination,
        valueUf: Number(record.valueUf)
      }));
      const total = entries.reduce((sum, entry) => sum + entry.valueUf, 0);

      return NextResponse.json({ entries, partidas: entries, total });
    }

    const { desdeDate, hastaDate } = resolveMonthRange(from, to);
    const records = await prisma.accountingRecord.findMany({
      where: {
        projectId,
        tenantId,
        period: { gte: desdeDate, lte: hastaDate },
        scenario: AccountingScenario.REAL
      },
      select: {
        group1: true,
        group3: true,
        denomination: true,
        valueUf: true,
        period: true
      },
      orderBy: [{ group1: "asc" }, { group3: "asc" }, { period: "asc" }]
    });

    const periods = [...new Set(records.map((record) => record.period.toISOString().slice(0, 7)))].sort();
    const lineMap = new Map<string, { group1: string; group3: string; byPeriod: Record<string, number>; total: number }>();

    for (const record of records) {
      const key = `${record.group1}||${record.group3}`;
      const periodKey = record.period.toISOString().slice(0, 7);
      const value = Number(record.valueUf);

      if (!lineMap.has(key)) {
        lineMap.set(key, {
          group1: record.group1,
          group3: record.group3,
          byPeriod: {},
          total: 0
        });
      }

      const line = lineMap.get(key)!;
      line.byPeriod[periodKey] = (line.byPeriod[periodKey] ?? 0) + value;
      line.total += value;
    }

    const lines = [...lineMap.values()];
    const total = lines.reduce((sum, line) => sum + line.total, 0);

    const legacyLines = lines.map((line) => ({
      grupo1: line.group1,
      grupo3: line.group3,
      porPeriodo: line.byPeriod,
      total: line.total
    }));

    return NextResponse.json({ periods, periodos: periods, lines, lineas: legacyLines, total });
  } catch (error) {
    return handleApiError(error);
  }
}
