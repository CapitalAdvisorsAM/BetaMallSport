/**
 * Builds facturación (billing intensity) time-series data in UF/m².
 * Replicates CDG Excel "Facturación" sheet logic.
 */

import type {
  FacturacionDimensionSeries,
  FacturacionResponse,
  FacturacionSeriesPoint
} from "@/types/billing";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type DecimalLike = number | string | { toString(): string };

export type FacturacionRecord = {
  period: Date;
  group3: string;
  valueUf: DecimalLike;
  sizeCategory: string | null;
  typeCategory: string | null;
  floor: string | null;
};

export type DimensionField = "tamano" | "tipo" | "piso";

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

function getDimValue(record: FacturacionRecord, field: DimensionField): string | null {
  if (field === "tamano") return record.sizeCategory;
  if (field === "tipo") return record.typeCategory;
  return record.floor;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildFacturacionTimeSeries(
  records: FacturacionRecord[],
  glaOccupied: Map<string, Map<string, number>>,
  glaTotals: Map<string, number>,
  periods: string[],
  dimensionField: DimensionField,
  includeBreakdown: boolean
): FacturacionResponse {
  // Aggregate billing by dimension + period (and optionally by group3)
  // Key: dimension → period → { total, byGroup3 }
  const agg = new Map<string, Map<string, { total: number; byGroup3: Map<string, number> }>>();
  const allGroup3 = new Set<string>();

  for (const r of records) {
    const dim = getDimValue(r, dimensionField);
    if (!dim) continue;

    const p = periodKey(r.period);
    const val = toNum(r.valueUf);
    allGroup3.add(r.group3);

    const dimMap = agg.get(dim) ?? new Map();
    const entry = dimMap.get(p) ?? { total: 0, byGroup3: new Map<string, number>() };
    entry.total += val;
    entry.byGroup3.set(r.group3, (entry.byGroup3.get(r.group3) ?? 0) + val);
    dimMap.set(p, entry);
    agg.set(dim, dimMap);
  }

  // Build series
  const series: FacturacionDimensionSeries[] = [];
  for (const [dim, periodMap] of agg) {
    const data: FacturacionSeriesPoint[] = periods.map((p) => {
      const entry = periodMap.get(p);
      const totalUf = entry?.total ?? 0;
      const glaM2 = glaOccupied.get(dim)?.get(p) ?? glaTotals.get(dim) ?? 0;
      const ufPerM2 = glaM2 > 0 ? totalUf / glaM2 : 0;

      const point: FacturacionSeriesPoint = { period: p, totalUf, glaM2, ufPerM2 };
      if (includeBreakdown && entry) {
        const breakdown: Record<string, number> = {};
        for (const [g3, val] of entry.byGroup3) {
          breakdown[g3] = glaM2 > 0 ? val / glaM2 : 0;
        }
        point.breakdown = breakdown;
      }
      return point;
    });
    series.push({ dimension: dim, data });
  }

  series.sort((a, b) => {
    const aTotal = a.data.reduce((s, d) => s + d.ufPerM2, 0);
    const bTotal = b.data.reduce((s, d) => s + d.ufPerM2, 0);
    return bTotal - aTotal;
  });

  // Build totals (aggregate across all dimensions)
  const totalGlaAll = [...glaTotals.values()].reduce((s, v) => s + v, 0);
  const totals: FacturacionSeriesPoint[] = periods.map((p) => {
    let totalUf = 0;
    for (const [, periodMap] of agg) {
      totalUf += periodMap.get(p)?.total ?? 0;
    }
    // Sum occupied GLA across all dimensions for this period
    let glaM2 = 0;
    for (const [, periodMap] of glaOccupied) {
      glaM2 += periodMap.get(p) ?? 0;
    }
    if (glaM2 === 0) glaM2 = totalGlaAll;
    return { period: p, totalUf, glaM2, ufPerM2: glaM2 > 0 ? totalUf / glaM2 : 0 };
  });

  return {
    periods,
    series,
    totals,
    availableGroup3: [...allGroup3].sort()
  };
}
