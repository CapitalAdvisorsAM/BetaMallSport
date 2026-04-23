import type { CashFlowResponse, CashFlowSection } from "@/types/finance";

type DecimalLike = number | string | { toString(): string };

export type BankMovementInput = {
  period: Date;
  classification: string;
  amountClp: DecimalLike;
};

function toNum(value: DecimalLike): number {
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export function buildCashFlow(records: BankMovementInput[]): CashFlowResponse {
  const periods = [...new Set(records.map((record) => record.period.toISOString().slice(0, 7)))].sort();
  const sectionMap = new Map<string, CashFlowSection>();
  const inflowsByPeriod: Record<string, number> = {};

  for (const record of records) {
    const period = record.period.toISOString().slice(0, 7);
    const amountClp = toNum(record.amountClp);

    if (!sectionMap.has(record.classification)) {
      sectionMap.set(record.classification, {
        classification: record.classification,
        byPeriod: {},
        total: 0,
      });
    }

    const section = sectionMap.get(record.classification)!;
    section.byPeriod[period] = (section.byPeriod[period] ?? 0) + amountClp;
    section.total += amountClp;
    inflowsByPeriod[period] = (inflowsByPeriod[period] ?? 0) + amountClp;
  }

  const sections = [...sectionMap.values()].sort((a, b) => b.total - a.total || a.classification.localeCompare(b.classification));
  const netByPeriod: Record<string, number> = {};
  const cumulativeByPeriod: Record<string, number> = {};
  let runningTotal = 0;

  for (const period of periods) {
    netByPeriod[period] = inflowsByPeriod[period] ?? 0;
    runningTotal += netByPeriod[period];
    cumulativeByPeriod[period] = runningTotal;
  }

  return { periods, sections, inflowsByPeriod, netByPeriod, cumulativeByPeriod };
}
