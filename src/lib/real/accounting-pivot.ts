import { AccountingScenario } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toPeriodKey } from "@/lib/real/period-range";

export type AccountingPivotArgs = {
  from: Date;
  to: Date;
  group1?: string | string[];
  group3?: string | string[];
  scenarios?: AccountingScenario[];
};

/**
 * In-memory pivot keyed by `${periodKey}|${group3}|${scenario}`.
 * Equivalent to the Excel CDG `SUMIFS('Data Contable'!$L:$L, ...)` pattern.
 */
export type AccountingPivotResult = Map<string, number>;

export function buildPivotKey(period: Date | string, group3: string, scenario: AccountingScenario): string {
  return `${toPeriodKey(period)}|${group3}|${scenario}`;
}

export async function pivotAccounting(
  projectId: string,
  args: AccountingPivotArgs
): Promise<AccountingPivotResult> {
  const grouped = await prisma.accountingRecord.groupBy({
    by: ["period", "group3", "scenario"],
    where: {
      projectId,
      period: { gte: args.from, lte: args.to },
      ...(args.group1
        ? { group1: Array.isArray(args.group1) ? { in: args.group1 } : args.group1 }
        : {}),
      ...(args.group3
        ? { group3: Array.isArray(args.group3) ? { in: args.group3 } : args.group3 }
        : {}),
      ...(args.scenarios && args.scenarios.length > 0
        ? { scenario: { in: args.scenarios } }
        : {})
    },
    _sum: { valueUf: true }
  });

  const result: AccountingPivotResult = new Map();
  for (const row of grouped) {
    const value = row._sum.valueUf;
    if (!value) continue;
    result.set(buildPivotKey(row.period, row.group3, row.scenario), Number(value.toString()));
  }
  return result;
}

/**
 * Reads a single (period, group3, scenario) cell from a pivot result.
 * Returns 0 when the combination is missing — mirrors the Excel SUMIFS
 * behaviour where empty matches resolve to 0 instead of #N/A.
 */
export function pivotValue(
  pivot: AccountingPivotResult,
  period: Date | string,
  group3: string,
  scenario: AccountingScenario
): number {
  return pivot.get(buildPivotKey(period, group3, scenario)) ?? 0;
}

/**
 * Sums all cells matching a (period, scenario) for a list of group3 values.
 * Useful for category buckets that aggregate multiple group3 lines (e.g.
 * "Ingreso fijo" rolling up several arriendo accounts).
 */
export function pivotSum(
  pivot: AccountingPivotResult,
  period: Date | string,
  group3List: readonly string[],
  scenario: AccountingScenario
): number {
  let total = 0;
  for (const group3 of group3List) {
    total += pivotValue(pivot, period, group3, scenario);
  }
  return total;
}
