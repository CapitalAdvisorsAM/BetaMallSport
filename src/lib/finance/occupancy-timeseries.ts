/**
 * Builds occupancy time-series data segmented by dimension (Tipo, Tamaño, Piso).
 * Replicates CDG Excel "Ocupación" sheet logic.
 */

import {
  buildGlaByDimensionPeriod,
  type DimensionField,
  type GlaContractInput,
  type GlaUnitInput
} from "@/lib/finance/gla-by-dimension";
import type {
  OccupancyDimensionRow,
  OccupancyPeriodSnapshot,
  OccupancyTimeSeriesResponse
} from "@/types/occupancy";

// ---------------------------------------------------------------------------
// Single-dimension snapshot
// ---------------------------------------------------------------------------

function buildDimensionRows(
  totals: Map<string, number>,
  occupied: Map<string, Map<string, number>>,
  period: string
): OccupancyDimensionRow[] {
  const rows: OccupancyDimensionRow[] = [];

  for (const [dim, glaTotal] of totals) {
    const glaOcupada = occupied.get(dim)?.get(period) ?? 0;
    const glaVacante = glaTotal - glaOcupada;
    rows.push({
      dimension: dim,
      glaTotal,
      glaOcupada,
      glaVacante,
      pctVacancia: glaTotal > 0 ? (glaVacante / glaTotal) * 100 : 0
    });
  }

  return rows.sort((a, b) => b.glaTotal - a.glaTotal);
}

function buildTotalsRow(rows: OccupancyDimensionRow[]): OccupancyDimensionRow {
  const glaTotal = rows.reduce((s, r) => s + r.glaTotal, 0);
  const glaOcupada = rows.reduce((s, r) => s + r.glaOcupada, 0);
  const glaVacante = glaTotal - glaOcupada;
  return {
    dimension: "Total",
    glaTotal,
    glaOcupada,
    glaVacante,
    pctVacancia: glaTotal > 0 ? (glaVacante / glaTotal) * 100 : 0
  };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

const DIMENSIONS: DimensionField[] = ["tipo", "tamano", "piso"];

export function buildOccupancyTimeSeries(
  units: GlaUnitInput[],
  contracts: GlaContractInput[],
  periods: string[]
): OccupancyTimeSeriesResponse {
  // Pre-compute GLA maps for all three dimensions
  const maps = Object.fromEntries(
    DIMENSIONS.map((d) => [d, buildGlaByDimensionPeriod(units, contracts, periods, d)])
  ) as Record<DimensionField, ReturnType<typeof buildGlaByDimensionPeriod>>;

  const snapshots: OccupancyPeriodSnapshot[] = periods.map((period) => {
    const byType = buildDimensionRows(maps.tipo.totals, maps.tipo.occupied, period);
    const bySize = buildDimensionRows(maps.tamano.totals, maps.tamano.occupied, period);
    const byFloor = buildDimensionRows(maps.piso.totals, maps.piso.occupied, period);

    // Totals computed from the "tamano" dimension (covers all GLA units)
    const totals = buildTotalsRow(bySize);

    return { period, byType, bySize, byFloor, totals };
  });

  return { periods, snapshots };
}
