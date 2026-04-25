import type { EeffGroup, EeffResponse } from "@/types/finance";

type DecimalLike = number | string | { toString(): string };

export type BalanceRecordInput = {
  period: Date;
  groupName: string;
  category: string;
  accountCode: string;
  accountName: string;
  valueUf: DecimalLike;
};

const GROUP_ORDER = [
  "Activos Corrientes",
  "Activos No Corrientes",
  "Pasivos Corrientes",
  "Pasivos No Corrientes",
  "Patrimonio",
];

function toNum(value: DecimalLike): number {
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

function byPeriodAccumulator<T extends { byPeriod: Record<string, number>; total: number }>(
  item: T,
  period: string,
  value: number
): void {
  item.byPeriod[period] = (item.byPeriod[period] ?? 0) + value;
  item.total += value;
}

function sortByPreferredOrder(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a);
    const bi = GROUP_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
  });
}

export function buildEeff(records: BalanceRecordInput[]): EeffResponse {
  const periods = [...new Set(records.map((record) => record.period.toISOString().slice(0, 7)))].sort();
  const groupMap = new Map<string, EeffGroup>();
  const liquidityByPeriod: Record<string, number> = {};
  const totalsByPeriod: Record<string, number> = {};

  for (const record of records) {
    const period = record.period.toISOString().slice(0, 7);
    const valueUf = toNum(record.valueUf);

    if (!groupMap.has(record.groupName)) {
      groupMap.set(record.groupName, {
        group: record.groupName,
        byPeriod: {},
        total: 0,
        categories: [],
      });
    }

    const group = groupMap.get(record.groupName)!;
    byPeriodAccumulator(group, period, valueUf);

    let category = group.categories.find((item) => item.category === record.category);
    if (!category) {
      category = {
        category: record.category,
        byPeriod: {},
        total: 0,
        lines: [],
      };
      group.categories.push(category);
    }
    byPeriodAccumulator(category, period, valueUf);

    let line = category.lines.find((item) => item.accountCode === record.accountCode);
    if (!line) {
      line = {
        accountCode: record.accountCode,
        accountName: record.accountName,
        byPeriod: {},
        total: 0,
      };
      category.lines.push(line);
    }
    byPeriodAccumulator(line, period, valueUf);

    totalsByPeriod[period] = (totalsByPeriod[period] ?? 0) + valueUf;
    if (record.category.toLowerCase().includes("efectivo")) {
      liquidityByPeriod[period] = (liquidityByPeriod[period] ?? 0) + valueUf;
    }
  }

  const groups = sortByPreferredOrder([...groupMap.keys()]).map((groupName) => {
    const group = groupMap.get(groupName)!;
    group.categories.sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
    group.categories.forEach((category) => {
      category.lines.sort((a, b) => b.total - a.total || a.accountCode.localeCompare(b.accountCode));
    });
    return group;
  });

  return { periods, groups, totalsByPeriod, liquidityByPeriod };
}
