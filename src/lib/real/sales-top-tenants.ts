/**
 * Builds the Top-N tenants ranking for /real/sales:
 *   Ventas UF (range) | UF/m² | YoY % | Costo Ocupación % (YTD-of-`hasta`)
 *
 * Costo ocupación % is computed via `computeCostoOcupacionByTenant` over a YTD
 * window anchored to the year of `period` (last month of the selected range),
 * matching `/real/reconciliation`. The denominator therefore does NOT depend on
 * the explicit [from, to] range, only its end month.
 */

import { yoyPct } from "@/lib/real/panel-kpis";
import {
  computeCostoOcupacionByTenant,
  type CostoBillingRecord,
  type CostoTenantContractInput,
  type CostoTenantSale
} from "@/lib/real/costo-ocupacion-per-tenant";
import { periodKey } from "@/lib/real/ventas-timeseries";
import type { TopTenantRow } from "@/types/sales-analytics";

type DecimalLike = number | string | { toString(): string };

export type TopTenantInput = {
  id: string;
  nombreComercial: string;
};

export type TopTenantSaleInput = {
  tenantId: string;
  period: Date;
  salesPesos: DecimalLike;
};

export type TopTenantContractInput = {
  arrendatarioId: string;
  localId: string;
  fechaInicio: Date;
  fechaTermino: Date;
};

export type TopTenantUnitInput = {
  id: string;
  glam2: DecimalLike;
  esGLA: boolean;
};

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export type BuildTopTenantsArgs = {
  tenants: TopTenantInput[];
  /** Sales in the user-selected [from, to] range (drives ranking). */
  sales: TopTenantSaleInput[];
  /** Sales in the prior calendar year of the same range (drives YoY %). */
  priorSales: TopTenantSaleInput[];
  /** Sales in the YTD-of-`hastaPeriod` window (drives costo ocupación denominator). */
  ytdSales: TopTenantSaleInput[];
  contracts: TopTenantContractInput[];
  units: TopTenantUnitInput[];
  records: CostoBillingRecord[];
  ufByPeriod: Map<string, number>;
  periods: string[];
  /** Last month of the selected range; YTD anchor for costo ocupación. */
  hastaPeriod: string;
  limit: number;
};

export function buildTopTenants(args: BuildTopTenantsArgs): TopTenantRow[] {
  const {
    tenants,
    sales,
    priorSales,
    ytdSales,
    contracts,
    units,
    records,
    ufByPeriod,
    periods,
    hastaPeriod,
    limit
  } = args;

  const periodSet = new Set(periods);
  const priorPeriodSet = new Set(
    periods.map((p) => {
      const d = new Date(`${p}-01T00:00:00Z`);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      return d.toISOString().slice(0, 7);
    })
  );

  const unitById = new Map(units.map((u) => [u.id, u]));

  // Tenant → assigned units active during the range (union across periods)
  const tenantUnits = new Map<string, Set<string>>();
  for (const c of contracts) {
    const periodFromDate = new Date(`${periods[0] ?? hastaPeriod}-01T00:00:00Z`);
    const periodToDate = new Date(`${periods[periods.length - 1] ?? hastaPeriod}-01T00:00:00Z`);
    periodToDate.setUTCMonth(periodToDate.getUTCMonth() + 1);
    periodToDate.setUTCDate(0);
    if (c.fechaInicio > periodToDate || c.fechaTermino < periodFromDate) continue;
    const set = tenantUnits.get(c.arrendatarioId) ?? new Set<string>();
    set.add(c.localId);
    tenantUnits.set(c.arrendatarioId, set);
  }

  // Tenant sales in UF for the range
  const salesUfByTenant = new Map<string, number>();
  for (const s of sales) {
    const p = periodKey(s.period);
    if (!periodSet.has(p)) continue;
    const uf = ufByPeriod.get(p) ?? 0;
    if (uf <= 0) continue;
    salesUfByTenant.set(
      s.tenantId,
      (salesUfByTenant.get(s.tenantId) ?? 0) + toNum(s.salesPesos) / uf
    );
  }

  // Prior-year sales in UF for the equivalent range
  const priorSalesUfByTenant = new Map<string, number>();
  for (const s of priorSales) {
    const p = periodKey(s.period);
    if (!priorPeriodSet.has(p)) continue;
    const uf = ufByPeriod.get(p) ?? 0;
    if (uf <= 0) continue;
    priorSalesUfByTenant.set(
      s.tenantId,
      (priorSalesUfByTenant.get(s.tenantId) ?? 0) + toNum(s.salesPesos) / uf
    );
  }

  // Costo ocupación YTD per tenant
  const tenantContracts: CostoTenantContractInput[] = contracts.map((c) => ({
    tenantId: c.arrendatarioId,
    unitId: c.localId
  }));
  const costoSales: CostoTenantSale[] = ytdSales.map((s) => ({
    tenantId: s.tenantId,
    period: s.period,
    salesPesos: s.salesPesos
  }));
  const costoByTenant = computeCostoOcupacionByTenant({
    tenantContracts,
    records,
    sales: costoSales,
    ufByPeriod,
    period: hastaPeriod
  });

  const rows: TopTenantRow[] = [];
  for (const tenant of tenants) {
    const assigned = tenantUnits.get(tenant.id);
    if (!assigned || assigned.size === 0) continue;
    let glaM2 = 0;
    for (const uid of assigned) {
      const u = unitById.get(uid);
      if (u && u.esGLA) glaM2 += toNum(u.glam2);
    }
    const ventasUf = salesUfByTenant.get(tenant.id) ?? 0;
    const priorUf = priorSalesUfByTenant.get(tenant.id) ?? 0;
    rows.push({
      tenantId: tenant.id,
      nombreComercial: tenant.nombreComercial,
      ventasUf,
      glaM2,
      ufPerM2: glaM2 > 0 ? ventasUf / glaM2 : 0,
      yoyPct: yoyPct(ventasUf, priorUf),
      costoOcupacionPct: costoByTenant.get(tenant.id) ?? null
    });
  }

  rows.sort((a, b) => b.ventasUf - a.ventasUf);
  return rows.slice(0, limit);
}
