/**
 * Pure helper: per-tenant occupancy cost % = facturación / ventas * 100.
 *
 * Aggregates billing (AccountingRecord) and sales (TenantSale) over a YTD-of-
 * `period` window. Mirrors the YTD math in `buildCostoOcupacionTable`
 * (src/lib/real/costo-ocupacion.ts) but exposes a flat `Map<tenantId, pct>` so
 * other features (top-tenants ranking) can consume it without rebuilding rows.
 */

type DecimalLike = number | string | { toString(): string };

export type CostoTenantContractInput = {
  tenantId: string;
  unitId: string;
};

export type CostoBillingRecord = {
  unitId: string | null;
  period: Date;
  valueUf: DecimalLike;
};

export type CostoTenantSale = {
  tenantId: string;
  period: Date;
  salesPesos: DecimalLike;
};

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function pKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export type ComputeCostoArgs = {
  tenantContracts: CostoTenantContractInput[];
  records: CostoBillingRecord[];
  sales: CostoTenantSale[];
  ufByPeriod: Map<string, number>;
  /** YTD denominator window: from `${year}-01` to `period`, inclusive. */
  period: string;
};

/**
 * Returns Map<tenantId, costoOcupacionPct | null>. Null when YTD sales = 0.
 */
export function computeCostoOcupacionByTenant(args: ComputeCostoArgs): Map<string, number | null> {
  const { tenantContracts, records, sales, ufByPeriod, period } = args;
  const year = period.slice(0, 4);
  const ytdFrom = `${year}-01`;

  // unitId → set of tenantIds that hold it (in practice 1, but be safe)
  const tenantsByUnit = new Map<string, Set<string>>();
  for (const tc of tenantContracts) {
    const set = tenantsByUnit.get(tc.unitId) ?? new Set<string>();
    set.add(tc.tenantId);
    tenantsByUnit.set(tc.unitId, set);
  }

  // Aggregate YTD billing per tenant
  const billingYtdByTenant = new Map<string, number>();
  for (const r of records) {
    if (!r.unitId) continue;
    const p = pKey(r.period);
    if (p < ytdFrom || p > period) continue;
    const tenants = tenantsByUnit.get(r.unitId);
    if (!tenants) continue;
    const v = toNum(r.valueUf);
    for (const tid of tenants) {
      billingYtdByTenant.set(tid, (billingYtdByTenant.get(tid) ?? 0) + v);
    }
  }

  // Aggregate YTD sales per tenant in UF
  const salesYtdByTenant = new Map<string, number>();
  for (const s of sales) {
    const p = pKey(s.period);
    if (p < ytdFrom || p > period) continue;
    const uf = ufByPeriod.get(p) ?? 0;
    if (uf <= 0) continue;
    const v = toNum(s.salesPesos) / uf;
    salesYtdByTenant.set(s.tenantId, (salesYtdByTenant.get(s.tenantId) ?? 0) + v);
  }

  const result = new Map<string, number | null>();
  const allTenantIds = new Set<string>([
    ...billingYtdByTenant.keys(),
    ...salesYtdByTenant.keys()
  ]);
  for (const tid of allTenantIds) {
    const bill = billingYtdByTenant.get(tid) ?? 0;
    const sal = salesYtdByTenant.get(tid) ?? 0;
    result.set(tid, sal > 0 ? (bill / sal) * 100 : null);
  }
  return result;
}
