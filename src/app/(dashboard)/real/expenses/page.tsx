import { redirect } from "next/navigation";
import { AccountingScenario } from "@prisma/client";
import { ExpensesClient } from "@/components/real/ExpensesClient";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { OPERATING_COST_GROUPS } from "@/lib/real/eerr";
import { resolveMonthRange } from "@/lib/real/period-range";
import type { ExpensePivotResponse, ExpensePivotRow } from "@/types/expenses";

const OPERATING_GROUPS_LIST = [...OPERATING_COST_GROUPS];

function shiftMonth(value: string | undefined, deltaMonths: number): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const baseDate = new Date(Number(match[1]), Number(match[2]) - 1 + deltaMonths, 1);
  const y = baseDate.getFullYear().toString().padStart(4, "0");
  const m = (baseDate.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

function enumeratePeriods(from: Date, to: Date): string[] {
  const periods: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    const y = cursor.getFullYear().toString().padStart(4, "0");
    const m = (cursor.getMonth() + 1).toString().padStart(2, "0");
    periods.push(`${y}-${m}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
}

export default async function RealExpensesPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  const desde = searchParams.from ?? searchParams.desde;
  const hasta = searchParams.to ?? searchParams.hasta;

  const { desdeDate, hastaDate } = resolveMonthRange(desde, hasta);
  const desdeYearAgo = shiftMonth(desde, -12);
  const hastaYearAgo = shiftMonth(hasta, -12);
  const { desdeDate: desdePriorDate, hastaDate: hastaPriorDate } = resolveMonthRange(
    desdeYearAgo,
    hastaYearAgo
  );

  const [chartAccounts, currentRecords, priorRecords] = await Promise.all([
    prisma.chartOfAccount.findMany({
      where: { projectId: selectedProjectId, group1: { in: OPERATING_GROUPS_LIST } },
      select: { group1: true, group3: true, displayOrder: true },
      orderBy: [{ displayOrder: "asc" }, { group1: "asc" }, { group3: "asc" }]
    }),
    prisma.accountingRecord.groupBy({
      by: ["group1", "group3", "period"],
      where: {
        projectId: selectedProjectId,
        scenario: AccountingScenario.REAL,
        group1: { in: OPERATING_GROUPS_LIST },
        period: { gte: desdeDate, lte: hastaDate }
      },
      _sum: { valueUf: true }
    }),
    prisma.accountingRecord.groupBy({
      by: ["group1", "group3"],
      where: {
        projectId: selectedProjectId,
        scenario: AccountingScenario.REAL,
        group1: { in: OPERATING_GROUPS_LIST },
        period: { gte: desdePriorDate, lte: hastaPriorDate }
      },
      _sum: { valueUf: true }
    })
  ]);

  const periods = enumeratePeriods(desdeDate, hastaDate);

  type CategoryKey = string;
  const categoryMeta = new Map<CategoryKey, { displayOrder: number | null }>();
  for (const account of chartAccounts) {
    const key = `${account.group1}::${account.group3}`;
    if (!categoryMeta.has(key)) {
      categoryMeta.set(key, { displayOrder: account.displayOrder ?? null });
    }
  }

  const rowMap = new Map<CategoryKey, ExpensePivotRow>();

  function ensureRow(group1: string, group3: string): ExpensePivotRow {
    const key = `${group1}::${group3}`;
    let row = rowMap.get(key);
    if (!row) {
      const meta = categoryMeta.get(key);
      row = {
        group1,
        group3,
        displayOrder: meta?.displayOrder ?? null,
        byPeriod: {},
        total: 0,
        totalPriorYear: null
      };
      rowMap.set(key, row);
    }
    return row;
  }

  for (const record of currentRecords) {
    const value = record._sum.valueUf ? Number(record._sum.valueUf) : 0;
    if (value === 0) continue;
    const periodKey = record.period.toISOString().slice(0, 7);
    const row = ensureRow(record.group1, record.group3);
    row.byPeriod[periodKey] = (row.byPeriod[periodKey] ?? 0) + value;
    row.total += value;
  }

  for (const record of priorRecords) {
    const value = record._sum.valueUf ? Number(record._sum.valueUf) : 0;
    if (value === 0) continue;
    const row = ensureRow(record.group1, record.group3);
    row.totalPriorYear = (row.totalPriorYear ?? 0) + value;
  }

  const totalsByPeriod: Record<string, number> = {};
  let total = 0;
  let totalPriorYear = 0;
  for (const row of rowMap.values()) {
    for (const period of periods) {
      const v = row.byPeriod[period] ?? 0;
      totalsByPeriod[period] = (totalsByPeriod[period] ?? 0) + v;
    }
    total += row.total;
    totalPriorYear += row.totalPriorYear ?? 0;
  }

  const groupOrder = new Map(OPERATING_GROUPS_LIST.map((g, idx) => [g, idx]));
  const rows = [...rowMap.values()].sort((a, b) => {
    const ga = groupOrder.get(a.group1) ?? 99;
    const gb = groupOrder.get(b.group1) ?? 99;
    if (ga !== gb) return ga - gb;
    const oa = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const ob = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.group3.localeCompare(b.group3);
  });

  const initialData: ExpensePivotResponse = {
    periods,
    rows,
    totalsByPeriod,
    total,
    totalPriorYear
  };

  return (
    <ExpensesClient
      selectedProjectId={selectedProjectId}
      defaultDesde={desde ?? periods[0] ?? ""}
      defaultHasta={hasta ?? periods[periods.length - 1] ?? ""}
      initialData={initialData}
    />
  );
}
