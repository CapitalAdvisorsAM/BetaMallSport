import { prisma } from "@/lib/prisma";

/**
 * Builds a Map<period, ufRate> for the given YYYY-MM periods.
 *
 * For each period, uses the first available UF value within that month.
 * Falls back to the most recent UF before the month if none exists for it.
 */
export async function buildUfRateMap(periods: string[]): Promise<Map<string, number>> {
  if (periods.length === 0) return new Map();

  const sorted = [...periods].sort();
  const [fy, fm] = sorted[0]!.split("-").map(Number) as [number, number];
  const [ly, lm] = sorted[sorted.length - 1]!.split("-").map(Number) as [number, number];

  // Fetch one month before the range for fallback, up to start of month after last period.
  const minDate = new Date(Date.UTC(fy, fm - 2, 1));
  const maxDate = new Date(Date.UTC(ly, lm, 1));

  const ufValues = await prisma.valorUF.findMany({
    where: { fecha: { gte: minDate, lt: maxDate } },
    select: { fecha: true, valor: true },
    orderBy: { fecha: "asc" },
  });

  const map = new Map<string, number>();

  for (const period of periods) {
    const [py, pm] = period.split("-").map(Number) as [number, number];
    const monthStart = new Date(Date.UTC(py, pm - 1, 1));
    const monthEnd = new Date(Date.UTC(py, pm, 1));

    // Prefer: first UF value within the month
    const inMonth = ufValues.find((v) => {
      const d = new Date(v.fecha);
      return d >= monthStart && d < monthEnd;
    });

    if (inMonth) {
      map.set(period, Number(inMonth.valor));
      continue;
    }

    // Fallback: most recent UF before the month
    const before = [...ufValues].reverse().find((v) => new Date(v.fecha) < monthStart);
    if (before) {
      map.set(period, Number(before.valor));
    }
  }

  return map;
}

/** Safe lookup — returns 0 when no UF rate is available for the period. */
export function getUfRate(period: string, ufRateByPeriod: Map<string, number>): number {
  return ufRateByPeriod.get(period) ?? 0;
}
