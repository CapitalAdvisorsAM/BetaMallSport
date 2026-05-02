/**
 * Builds ventas (sales) time-series data in UF and UF/m².
 * Replicates CDG Excel "Ventas" sheet logic.
 *
 * Sales are attributed from a tenant to its active units' dimension buckets,
 * proportionally by GLA. The same `distributeSalesToUnits` helper is reused by
 * `buildSalesCrosstab` and `buildSalesKpis`.
 */

import { toNum } from "@/lib/real/billing-utils";
import { toPeriodKey as periodKey } from "@/lib/real/period-range";
import type {
  VentasDimensionSeries,
  VentasSeriesPoint,
  VentasTimeseriesResponse
} from "@/types/sales-analytics";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type DecimalLike = number | string | { toString(): string };

export type VentaSaleInput = {
  tenantId: string;
  period: Date;
  salesPesos: DecimalLike;
};

export type VentaContractInput = {
  localId: string;
  arrendatarioId: string;
  fechaInicio: Date;
  fechaTermino: Date;
};

export type VentaUnitInput = {
  id: string;
  glam2: DecimalLike;
  dimensionValue: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export { periodKey };

function periodBounds(period: string): { start: Date; end: Date } {
  const start = new Date(`${period}-01T00:00:00Z`);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const end = new Date(Date.UTC(y, m + 1, 0));
  return { start, end };
}

/**
 * For each tenant active in `period`, returns the list of `{ dim, gla }` entries
 * derived from the units they hold. Used to distribute tenant-level sales across
 * dimensional buckets proportionally by GLA.
 */
export function tenantDimensionGlaForPeriod(
  contracts: VentaContractInput[],
  units: VentaUnitInput[],
  period: string
): Map<string, { dim: string; gla: number }[]> {
  const unitById = new Map(units.map((u) => [u.id, u]));
  const result = new Map<string, { dim: string; gla: number }[]>();
  const { start, end } = periodBounds(period);

  for (const c of contracts) {
    if (c.fechaInicio > end || c.fechaTermino < start) continue;
    const unit = unitById.get(c.localId);
    if (!unit || !unit.dimensionValue) continue;

    const list = result.get(c.arrendatarioId) ?? [];
    list.push({ dim: unit.dimensionValue, gla: toNum(unit.glam2) });
    result.set(c.arrendatarioId, list);
  }
  return result;
}

/**
 * Distributes tenant sales (pesos) across dimensional buckets per period,
 * proportionally by the tenant's unit GLA in that period.
 *
 * Returns nested map: dimension → period → salesPesos.
 */
export function distributeSalesToUnits(
  sales: VentaSaleInput[],
  contracts: VentaContractInput[],
  units: VentaUnitInput[],
  periods: string[]
): Map<string, Map<string, number>> {
  const periodSet = new Set(periods);
  const agg = new Map<string, Map<string, number>>();

  // Pre-compute tenantDimensionGla per period (avoid recomputing per sale)
  const tenantGlaByPeriod = new Map<string, Map<string, { dim: string; gla: number }[]>>();
  for (const p of periods) {
    tenantGlaByPeriod.set(p, tenantDimensionGlaForPeriod(contracts, units, p));
  }

  for (const sale of sales) {
    const p = periodKey(sale.period);
    if (!periodSet.has(p)) continue;

    const tenantUnits = tenantGlaByPeriod.get(p)?.get(sale.tenantId);
    if (!tenantUnits || tenantUnits.length === 0) continue;

    const totalGla = tenantUnits.reduce((s, u) => s + u.gla, 0);
    if (totalGla <= 0) continue;

    const salesVal = toNum(sale.salesPesos);

    for (const { dim, gla } of tenantUnits) {
      const share = (gla / totalGla) * salesVal;
      const dimMap = agg.get(dim) ?? new Map<string, number>();
      dimMap.set(p, (dimMap.get(p) ?? 0) + share);
      agg.set(dim, dimMap);
    }
  }

  return agg;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildVentasTimeSeries(
  sales: VentaSaleInput[],
  contracts: VentaContractInput[],
  units: VentaUnitInput[],
  glaOccupied: Map<string, Map<string, number>>,
  glaTotals: Map<string, number>,
  periods: string[],
  ufByPeriod: Map<string, number>,
  priorSales?: VentaSaleInput[]
): VentasTimeseriesResponse {
  const agg = distributeSalesToUnits(sales, contracts, units, periods);

  // Distribute prior-year sales into the same dimension buckets but offset by 12 months,
  // so the prior value lines up with the current period's calendar slot.
  const priorAgg = priorSales
    ? distributePriorSalesToCurrentPeriods(priorSales, contracts, units, periods)
    : new Map<string, Map<string, number>>();

  const series: VentasDimensionSeries[] = [];
  for (const [dim, periodMap] of agg) {
    const data: VentasSeriesPoint[] = periods.map((p) => {
      const salesPesos = periodMap.get(p) ?? 0;
      const glaM2 = glaOccupied.get(dim)?.get(p) ?? glaTotals.get(dim) ?? 0;
      const uf = ufByPeriod.get(p) ?? 0;
      const salesUf = uf > 0 ? salesPesos / uf : 0;
      const priorPesos = priorAgg.get(dim)?.get(p);
      const priorSalesUf = priorPesos === undefined ? null : (uf > 0 ? priorPesos / uf : 0);
      return {
        period: p,
        salesPesos,
        salesUf,
        glaM2,
        salesPesosM2: glaM2 > 0 ? salesPesos / glaM2 : 0,
        salesUfM2: glaM2 > 0 ? salesUf / glaM2 : 0,
        priorSalesUf
      };
    });
    series.push({ dimension: dim, data });
  }

  series.sort((a, b) => {
    const aTotal = a.data.reduce((s, d) => s + d.salesUfM2, 0);
    const bTotal = b.data.reduce((s, d) => s + d.salesUfM2, 0);
    return bTotal - aTotal;
  });

  // Totals
  const totals: VentasSeriesPoint[] = periods.map((p) => {
    let salesPesos = 0;
    for (const periodMap of agg.values()) {
      salesPesos += periodMap.get(p) ?? 0;
    }
    let glaM2 = 0;
    for (const periodMap of glaOccupied.values()) {
      glaM2 += periodMap.get(p) ?? 0;
    }
    let priorPesos: number | null = null;
    if (priorSales) {
      priorPesos = 0;
      for (const periodMap of priorAgg.values()) {
        priorPesos += periodMap.get(p) ?? 0;
      }
    }
    const uf = ufByPeriod.get(p) ?? 0;
    const salesUf = uf > 0 ? salesPesos / uf : 0;
    const priorSalesUf = priorPesos === null ? null : (uf > 0 ? priorPesos / uf : 0);
    return {
      period: p,
      salesPesos,
      salesUf,
      glaM2,
      salesPesosM2: glaM2 > 0 ? salesPesos / glaM2 : 0,
      salesUfM2: glaM2 > 0 ? salesUf / glaM2 : 0,
      priorSalesUf
    };
  });

  return { mode: "timeseries", periods, series, totals };
}

/**
 * Distributes prior-year sales onto the current period grid by shifting their
 * period key forward by 12 months. The dimensional attribution still uses the
 * CURRENT period's tenant→unit configuration (so YoY compares like-for-like
 * portfolio composition, not historical assignments).
 */
function distributePriorSalesToCurrentPeriods(
  priorSales: VentaSaleInput[],
  contracts: VentaContractInput[],
  units: VentaUnitInput[],
  periods: string[]
): Map<string, Map<string, number>> {
  const shifted: VentaSaleInput[] = priorSales.map((s) => {
    const shiftedDate = new Date(s.period);
    shiftedDate.setUTCFullYear(shiftedDate.getUTCFullYear() + 1);
    return { ...s, period: shiftedDate };
  });
  return distributeSalesToUnits(shifted, contracts, units, periods);
}
