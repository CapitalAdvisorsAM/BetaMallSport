import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceMode, getFinancePeriod, getFinanceProjectId } from "@/lib/finance/api-params";
import { BELOW_EBITDA_GROUPS } from "@/lib/finance/eerr";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Mode = "month" | "year" | "ltm";

function getRange(mode: Mode, period: string): { fromDate: Date; toDate: Date } {
  if (mode === "month") {
    const d = new Date(`${period}-01`);
    return { fromDate: d, toDate: d };
  }
  if (mode === "year") {
    return {
      fromDate: new Date(`${period}-01-01`),
      toDate: new Date(`${period}-12-01`)
    };
  }
  const end = new Date(`${period}-01`);
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  return { fromDate: start, toDate: end };
}

function shiftYearBack(range: { fromDate: Date; toDate: Date }) {
  return {
    fromDate: new Date(range.fromDate.getFullYear() - 1, range.fromDate.getMonth(), 1),
    toDate: new Date(range.toDate.getFullYear() - 1, range.toDate.getMonth(), 1)
  };
}

function ytdRange(period: string) {
  const year = period.slice(0, 4);
  return {
    fromDate: new Date(`${year}-01-01`),
    toDate: new Date(`${period}-01`)
  };
}

function normalizeValue(_group1: string, raw: { toString(): string }): number {
  return Number(raw);
}

function sumRecords(
  records: { group1: string; valueUf: { toString(): string } }[],
  includeGroups?: Set<string>
): number {
  return records.reduce((sum, record) => {
    if (includeGroups && !includeGroups.has(record.group1)) {
      return sum;
    }
    return sum + normalizeValue(record.group1, record.valueUf);
  }, 0);
}

function sumEbitda(records: { group1: string; valueUf: { toString(): string } }[]): number {
  return records.reduce((sum, record) => {
    if (BELOW_EBITDA_GROUPS.has(record.group1)) {
      return sum;
    }
    return sum + normalizeValue(record.group1, record.valueUf);
  }, 0);
}

async function queryPeriod(projectId: string, from: Date, to: Date) {
  return prisma.accountingRecord.findMany({
    where: { projectId, period: { gte: from, lte: to } },
    select: { group1: true, period: true, valueUf: true }
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const projectId = getFinanceProjectId(searchParams);
    const rawMode = getFinanceMode(searchParams) ?? "month";
    const mode: Mode =
      rawMode === "ltm"
        ? "ltm"
        : rawMode === "year" || rawMode === "año" || rawMode === "anio" || rawMode === "año"
          ? "year"
          : "month";
    const period = getFinancePeriod(searchParams);

    if (!projectId) throw new ApiError(400, "projectId requerido.");
    if (!period) throw new ApiError(400, "period requerido.");

    const range = getRange(mode, period);
    const priorRange = shiftYearBack(range);

    const [currentRecords, priorRecords, glaUnits, activeContracts] = await Promise.all([
      queryPeriod(projectId, range.fromDate, range.toDate),
      queryPeriod(projectId, priorRange.fromDate, priorRange.toDate),
      prisma.unit.findMany({
        where: { proyectoId: projectId, esGLA: true },
        select: { id: true, glam2: true }
      }),
      mode === "month"
        ? prisma.contract.findMany({
            where: {
              proyectoId: projectId,
              fechaInicio: { lte: range.fromDate },
              fechaTermino: { gte: range.fromDate }
            },
            select: { localId: true }
          })
        : Promise.resolve<Array<{ localId: string }>>([])
    ]);

    const INCOME_GROUPS = new Set(["INGRESOS DE EXPLOTACION"]);
    const currentIncome = sumRecords(currentRecords, INCOME_GROUPS);
    const priorIncome = sumRecords(priorRecords, INCOME_GROUPS);
    const currentEbitda = sumEbitda(currentRecords);
    const priorEbitda = sumEbitda(priorRecords);

    let ytdIncome: { current: number; prior: number } | null = null;
    let ytdEbitda: { current: number; prior: number } | null = null;
    if (mode === "month") {
      const ytd = ytdRange(period);
      const priorYtd = shiftYearBack(ytd);
      const [ytdRecords, priorYtdRecords] = await Promise.all([
        queryPeriod(projectId, ytd.fromDate, ytd.toDate),
        queryPeriod(projectId, priorYtd.fromDate, priorYtd.toDate)
      ]);
      ytdIncome = {
        current: sumRecords(ytdRecords, INCOME_GROUPS),
        prior: sumRecords(priorYtdRecords, INCOME_GROUPS)
      };
      ytdEbitda = {
        current: sumEbitda(ytdRecords),
        prior: sumEbitda(priorYtdRecords)
      };
    }

    const totalGlaM2 = glaUnits.reduce((sum, unit) => sum + Number(unit.glam2), 0);
    const ufPerM2 = totalGlaM2 > 0 ? currentIncome / totalGlaM2 : null;

    let vacancyPct: number | null = null;
    const totalGlaUnits = glaUnits.length;
    let occupiedUnits = 0;
    if (mode === "month") {
      const occupiedSet = new Set(activeContracts.map((contract) => contract.localId));
      occupiedUnits = glaUnits.filter((unit) => occupiedSet.has(unit.id)).length;
      vacancyPct = totalGlaUnits > 0 ? ((totalGlaUnits - occupiedUnits) / totalGlaUnits) * 100 : null;
    }

    const months: string[] = [];
    const cursor = new Date(range.fromDate);
    while (cursor <= range.toDate) {
      months.push(cursor.toISOString().slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const incomeByMonth = new Map<string, number>();
    const ebitdaByMonth = new Map<string, number>();
    const priorIncomeByMonth = new Map<string, number>();

    for (const record of currentRecords) {
      const monthKey = record.period.toISOString().slice(0, 7);
      const value = normalizeValue(record.group1, record.valueUf);
      if (record.group1 === "INGRESOS DE EXPLOTACION") {
        incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) ?? 0) + value);
      }
      if (!BELOW_EBITDA_GROUPS.has(record.group1)) {
        ebitdaByMonth.set(monthKey, (ebitdaByMonth.get(monthKey) ?? 0) + value);
      }
    }

    for (const record of priorRecords) {
      const priorDate = record.period;
      const alignedKey = `${priorDate.getFullYear() + 1}-${String(priorDate.getMonth() + 1).padStart(2, "0")}`;
      if (record.group1 === "INGRESOS DE EXPLOTACION") {
        priorIncomeByMonth.set(
          alignedKey,
          (priorIncomeByMonth.get(alignedKey) ?? 0) + normalizeValue(record.group1, record.valueUf)
        );
      }
    }

    const chart = {
      months,
      currentIncome: months.map((month) => incomeByMonth.get(month) ?? 0),
      priorIncome: months.map((month) => priorIncomeByMonth.get(month) ?? 0),
      currentEbitda: months.map((month) => ebitdaByMonth.get(month) ?? 0)
    };

    const sectionsMap = new Map<string, { current: number; prior: number }>();
    for (const record of currentRecords) {
      const section = sectionsMap.get(record.group1) ?? { current: 0, prior: 0 };
      section.current += normalizeValue(record.group1, record.valueUf);
      sectionsMap.set(record.group1, section);
    }
    for (const record of priorRecords) {
      const section = sectionsMap.get(record.group1) ?? { current: 0, prior: 0 };
      section.prior += normalizeValue(record.group1, record.valueUf);
      sectionsMap.set(record.group1, section);
    }

    const sectionsEerr = [...sectionsMap.entries()].map(([group1, values]) => ({ group1, ...values }));

    return NextResponse.json({
      kpis: {
        income: { current: currentIncome, prior: priorIncome },
        ebitda: {
          current: currentEbitda,
          prior: priorEbitda,
          marginPct: currentIncome !== 0 ? (currentEbitda / currentIncome) * 100 : null
        },
        ytdIncome,
        ytdEbitda,
        ufPerM2,
        vacancyPct,
        totalGlaUnits,
        occupiedUnits
      },
      chart,
      sectionsEerr
    });
  } catch (error) {
    return handleApiError(error);
  }
}
