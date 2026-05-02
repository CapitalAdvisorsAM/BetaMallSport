import type { CashFlowBankSeries, CashFlowResponse, CashFlowSection } from "@/types/finance";

type DecimalLike = number | string | { toString(): string };

export type BankMovementInput = {
  period: Date;
  classification: string;
  amountClp: DecimalLike;
  bank?: string;
};

export type FondosMutuosInput = {
  period: Date;
  balanceClp: DecimalLike;
};

function toNum(value: DecimalLike): number {
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export function buildCashFlow(
  records: BankMovementInput[],
  fondosRecords: FondosMutuosInput[] = []
): CashFlowResponse {
  const periods = [...new Set(records.map((r) => r.period.toISOString().slice(0, 7)))].sort();
  const sectionMap = new Map<string, CashFlowSection>();
  const inflowsByPeriod: Record<string, number> = {};

  for (const record of records) {
    const period = record.period.toISOString().slice(0, 7);
    const amountClp = toNum(record.amountClp);

    if (!sectionMap.has(record.classification)) {
      sectionMap.set(record.classification, { classification: record.classification, byPeriod: {}, total: 0 });
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

  // Bank breakdown — cumulative net balance per bank per period
  const bankNetByBankPeriod = new Map<string, Record<string, number>>();
  for (const record of records) {
    const bank = record.bank;
    if (!bank) continue;
    const period = record.period.toISOString().slice(0, 7);
    const amountClp = toNum(record.amountClp);
    if (!bankNetByBankPeriod.has(bank)) bankNetByBankPeriod.set(bank, {});
    const byPeriod = bankNetByBankPeriod.get(bank)!;
    byPeriod[period] = (byPeriod[period] ?? 0) + amountClp;
  }

  const bankNames = [...bankNetByBankPeriod.keys()].sort((a, b) => {
    const totA = Object.values(bankNetByBankPeriod.get(a)!).reduce((s, v) => s + v, 0);
    const totB = Object.values(bankNetByBankPeriod.get(b)!).reduce((s, v) => s + v, 0);
    return totB - totA;
  });

  const bankBreakdown: CashFlowBankSeries[] = bankNames.map((bank) => {
    const netMap = bankNetByBankPeriod.get(bank)!;
    const cumulByPeriod: Record<string, number> = {};
    let running = 0;
    for (const period of periods) {
      running += netMap[period] ?? 0;
      cumulByPeriod[period] = running;
    }
    return { bank, byPeriod: cumulByPeriod };
  });

  // Fondos mutuos — sum balance per period (from BalanceRecord)
  const fondosMutuosByPeriod: Record<string, number> = {};
  for (const r of fondosRecords) {
    const period = r.period.toISOString().slice(0, 7);
    fondosMutuosByPeriod[period] = (fondosMutuosByPeriod[period] ?? 0) + toNum(r.balanceClp);
  }

  return {
    periods,
    sections,
    inflowsByPeriod,
    netByPeriod,
    cumulativeByPeriod,
    bankNames,
    bankBreakdown,
    fondosMutuosByPeriod,
  };
}
