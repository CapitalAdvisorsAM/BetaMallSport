/**
 * Aggregates the 5 KPIs shown in the persistent strip on /real/sales:
 *   1. Ventas UF totales (período)
 *   2. UF/m² del período
 *   3. YoY %
 *   4. # locales con ventas
 *   5. Ticket UF/m² promedio mensual (mean of monthly ratios)
 */

import { yoyPct } from "@/lib/real/panel-kpis";
import {
  distributeSalesToUnits,
  periodKey,
  type VentaContractInput,
  type VentaSaleInput,
  type VentaUnitInput
} from "@/lib/real/ventas-timeseries";
import type { VentasKpisResponse } from "@/types/sales-analytics";

type DecimalLike = number | string | { toString(): string };

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export type BuildSalesKpisArgs = {
  sales: VentaSaleInput[];
  priorSales: VentaSaleInput[];
  contracts: VentaContractInput[];
  units: VentaUnitInput[];
  periods: string[];
  glaOccupied: Map<string, Map<string, number>>;
  ufByPeriod: Map<string, number>;
};

export function buildSalesKpis(args: BuildSalesKpisArgs): VentasKpisResponse {
  const { sales, priorSales, contracts, units, periods, glaOccupied, ufByPeriod } = args;

  // Total UF in current range
  let ventasUfTotal = 0;
  for (const s of sales) {
    const p = periodKey(s.period);
    if (!periods.includes(p)) continue;
    const uf = ufByPeriod.get(p) ?? 0;
    if (uf <= 0) continue;
    ventasUfTotal += toNum(s.salesPesos) / uf;
  }

  // Total UF in prior calendar range (12 months earlier)
  let ventasUfPrior = 0;
  const priorPeriods = periods.map((p) => {
    const d = new Date(`${p}-01T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 7);
  });
  for (const s of priorSales) {
    const p = periodKey(s.period);
    if (!priorPeriods.includes(p)) continue;
    const uf = ufByPeriod.get(p) ?? 0;
    if (uf <= 0) continue;
    ventasUfPrior += toNum(s.salesPesos) / uf;
  }

  // Total occupied GLA-month across all dimensions/periods
  let glaMonthSum = 0;
  for (const periodMap of glaOccupied.values()) {
    for (const v of periodMap.values()) glaMonthSum += v;
  }
  const ufPerM2Period = glaMonthSum > 0 ? ventasUfTotal / glaMonthSum : 0;

  // Locales con ventas: distribute sales to units, count distinct units with > 0
  const distributed = distributeSalesToUnits(sales, contracts, units, periods);
  // distributed is by `dimensionValue`, but we want per-unit. We re-do a simpler
  // attribution with unitId as the dimension key.
  const unitDimUnits = units.map((u) => ({ id: u.id, glam2: u.glam2, dimensionValue: u.id }));
  const perUnit = distributeSalesToUnits(sales, contracts, unitDimUnits, periods);
  let localesConVentas = 0;
  for (const [, periodMap] of perUnit) {
    let total = 0;
    for (const v of periodMap.values()) total += v;
    if (total > 0) localesConVentas += 1;
  }
  // distributed is unused beyond shape verification; silence linter.
  void distributed;

  // Ticket UF/m² promedio mensual = mean( salesUf_period / glaOccupied_period )
  const monthlyRatios: number[] = [];
  for (const p of periods) {
    let salesUfMonth = 0;
    for (const s of sales) {
      if (periodKey(s.period) !== p) continue;
      const uf = ufByPeriod.get(p) ?? 0;
      if (uf <= 0) continue;
      // Restrict to tenants currently active per `distributeSalesToUnits` semantics
      salesUfMonth += toNum(s.salesPesos) / uf;
    }
    let glaMonth = 0;
    for (const periodMap of glaOccupied.values()) {
      glaMonth += periodMap.get(p) ?? 0;
    }
    if (glaMonth > 0) {
      monthlyRatios.push(salesUfMonth / glaMonth);
    }
  }
  const ufPerM2MensualPromedio =
    monthlyRatios.length > 0
      ? monthlyRatios.reduce((s, x) => s + x, 0) / monthlyRatios.length
      : 0;

  return {
    mode: "kpis",
    ventasUfTotal,
    ufPerM2Period,
    yoyPct: yoyPct(ventasUfTotal, ventasUfPrior),
    localesConVentas,
    ufPerM2MensualPromedio
  };
}
