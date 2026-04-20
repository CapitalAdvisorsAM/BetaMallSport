/**
 * Builds ventas (sales) time-series data in UF/m².
 * Replicates CDG Excel "Ventas" sheet logic.
 */

import type {
  VentasAnalyticsResponse,
  VentasDimensionSeries,
  VentasSeriesPoint
} from "@/types/ventas-analytics";

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

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function periodKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function periodBounds(period: string): { start: Date; end: Date } {
  const start = new Date(`${period}-01T00:00:00Z`);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const end = new Date(Date.UTC(y, m + 1, 0));
  return { start, end };
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
  periods: string[]
): VentasAnalyticsResponse {
  const unitById = new Map(units.map((u) => [u.id, u]));

  // Build tenant → units for each period (from active contracts)
  // For sales attribution, distribute tenant sales across their units' dimensions
  // proportionally by GLA.
  // tenantId → [{ dimensionValue, glaM2 }]
  function tenantDimensionGla(period: string): Map<string, { dim: string; gla: number }[]> {
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

  // Aggregate sales by dimension + period
  const agg = new Map<string, Map<string, number>>();

  for (const sale of sales) {
    const p = periodKey(sale.period);
    if (!periods.includes(p)) continue;

    const tenantUnits = tenantDimensionGla(p).get(sale.tenantId);
    if (!tenantUnits || tenantUnits.length === 0) continue;

    const totalGla = tenantUnits.reduce((s, u) => s + u.gla, 0);
    if (totalGla <= 0) continue;

    const salesVal = toNum(sale.salesPesos);

    // Distribute sales proportionally
    for (const { dim, gla } of tenantUnits) {
      const share = (gla / totalGla) * salesVal;
      const dimMap = agg.get(dim) ?? new Map<string, number>();
      dimMap.set(p, (dimMap.get(p) ?? 0) + share);
      agg.set(dim, dimMap);
    }
  }

  // Build series
  const series: VentasDimensionSeries[] = [];
  for (const [dim, periodMap] of agg) {
    const data: VentasSeriesPoint[] = periods.map((p) => {
      const salesPesos = periodMap.get(p) ?? 0;
      const glaM2 = glaOccupied.get(dim)?.get(p) ?? glaTotals.get(dim) ?? 0;
      return {
        period: p,
        salesPesos,
        glaM2,
        salesPesosM2: glaM2 > 0 ? salesPesos / glaM2 : 0
      };
    });
    series.push({ dimension: dim, data });
  }

  series.sort((a, b) => {
    const aTotal = a.data.reduce((s, d) => s + d.salesPesosM2, 0);
    const bTotal = b.data.reduce((s, d) => s + d.salesPesosM2, 0);
    return bTotal - aTotal;
  });

  // Totals
  const totals: VentasSeriesPoint[] = periods.map((p) => {
    let salesPesos = 0;
    for (const [, periodMap] of agg) {
      salesPesos += periodMap.get(p) ?? 0;
    }
    let glaM2 = 0;
    for (const [, periodMap] of glaOccupied) {
      glaM2 += periodMap.get(p) ?? 0;
    }
    return {
      period: p,
      salesPesos,
      glaM2,
      salesPesosM2: glaM2 > 0 ? salesPesos / glaM2 : 0
    };
  });

  return { periods, series, totals };
}
