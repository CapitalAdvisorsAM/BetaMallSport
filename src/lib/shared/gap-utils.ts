/**
 * Shared billing gap utilities.
 *
 * Computes actual billing from AccountingRecord data and compares it
 * against the expected billing already calculated in the rent roll snapshot.
 */

type AccountingInput = {
  unitId: string | null;
  valueUf: number;
  group1: string;
};

const REVENUE_GROUP = "INGRESOS DE EXPLOTACION";

/**
 * Aggregates actual billing (UF) by unitId from accounting records.
 * Only includes records in the revenue group ("INGRESOS DE EXPLOTACION").
 */
export function buildActualBillingByUnit(
  records: AccountingInput[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    if (r.group1 !== REVENUE_GROUP || !r.unitId) continue;
    map.set(r.unitId, (map.get(r.unitId) ?? 0) + r.valueUf);
  }
  return map;
}

export type GapSeverity = "ok" | "warning" | "danger";

/**
 * Returns gap severity based on the absolute gap percentage.
 * - ok: |gap%| < 2%
 * - warning: 2% <= |gap%| < 10%
 * - danger: |gap%| >= 10%
 */
export function getGapSeverity(gapPct: number): GapSeverity {
  const abs = Math.abs(gapPct);
  if (abs < 2) return "ok";
  if (abs < 10) return "warning";
  return "danger";
}
