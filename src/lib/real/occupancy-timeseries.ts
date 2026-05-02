/**
 * Builds occupancy time-series data segmented by dimension (Tipo, Tamaño, Piso).
 * Replicates CDG Excel "Ocupación" sheet logic.
 */

import {
  buildGlaByDimensionPeriod,
  type DimensionField,
  type GlaContractInput,
  type GlaUnitInput
} from "@/lib/real/gla-by-dimension";
import type {
  OccupancyDimensionRow,
  OccupancyPeriodSnapshot,
  OccupancyTimeSeriesResponse,
  VacantUnitRow
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
// Vacant units for a period
// ---------------------------------------------------------------------------

function periodEnd(period: string): Date {
  const start = new Date(`${period}-01T00:00:00Z`);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0));
}

function buildVacantUnits(
  units: GlaUnitInput[],
  contracts: GlaContractInput[],
  period: string
): VacantUnitRow[] {
  const end = periodEnd(period);
  const occupiedIds = new Set<string>();
  for (const c of contracts) {
    if (c.fechaInicio <= end && c.fechaTermino >= end) {
      occupiedIds.add(c.localId);
    }
  }

  return units
    .filter((u) => u.esGLA && !occupiedIds.has(u.id))
    .map((u) => ({
      id: u.id,
      codigo: u.codigo ?? "",
      nombre: u.nombre ?? null,
      piso: u.piso,
      tipo: u.tipo,
      categoriaTamano: u.categoriaTamano ?? null,
      zona: u.zona ?? null,
      glam2: Number(u.glam2.toString())
    }))
    .sort((a, b) => a.piso.localeCompare(b.piso) || a.codigo.localeCompare(b.codigo));
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

  const lastPeriod = periods[periods.length - 1];
  const vacantUnits = lastPeriod ? buildVacantUnits(units, contracts, lastPeriod) : [];

  return { periods, snapshots, vacantUnits };
}
