/**
 * Shared helper: computes occupied GLA per dimension bucket per period.
 * Used by occupancy, facturacion, ventas, and GGCC features.
 */

import { UnitType } from "@prisma/client";
import { mapCategoria } from "@/lib/kpi";
import { toPeriodKey } from "@/lib/finance/period-range";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type DecimalLike = number | string | { toString(): string };

export type GlaUnitInput = {
  id: string;
  tipo: UnitType;
  esGLA: boolean;
  glam2: DecimalLike;
  piso: string;
  zona?: string | null;
};

export type GlaContractInput = {
  localId: string;
  fechaInicio: Date;
  fechaTermino: Date;
};

export type DimensionField = "tipo" | "tamano" | "piso";

// ---------------------------------------------------------------------------
// Size-bucket mapping (mirrors kpi.ts logic)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TAMANOS = [
  "Tienda Mayor",
  "Tienda Mediana",
  "Tienda Menor",
  "Modulo",
  "Bodega"
] as const;

export type TamanoLabel = (typeof TAMANOS)[number];

export function mapTamanoFromUnit(unit: GlaUnitInput): TamanoLabel {
  if (unit.tipo === UnitType.BODEGA) return "Bodega";
  if (unit.tipo === UnitType.MODULO || unit.tipo === UnitType.SIMULADOR) return "Modulo";
  const gla = toNum(unit.glam2);
  if (gla > 200) return "Tienda Mayor";
  if (gla >= 50) return "Tienda Mediana";
  return "Tienda Menor";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function getDimensionValue(unit: GlaUnitInput, field: DimensionField): string | null {
  if (field === "tipo") return mapCategoria(unit.zona);
  if (field === "tamano") return mapTamanoFromUnit(unit);
  return unit.piso || null;
}

function isContractActiveInPeriod(c: GlaContractInput, periodStart: Date, periodEnd: Date): boolean {
  return c.fechaInicio <= periodEnd && c.fechaTermino >= periodStart;
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

/**
 * Returns a nested map: dimensionValue → period → occupiedGLA.
 * Also returns totalGLA per dimension (does not change across periods).
 */
export function buildGlaByDimensionPeriod(
  units: GlaUnitInput[],
  contracts: GlaContractInput[],
  periods: string[],
  dimensionField: DimensionField
): {
  occupied: Map<string, Map<string, number>>;
  totals: Map<string, number>;
} {
  const glaUnits = units.filter((u) => u.esGLA);
  const unitById = new Map(glaUnits.map((u) => [u.id, u]));

  // Total GLA per dimension (static across periods)
  const totals = new Map<string, number>();
  for (const u of glaUnits) {
    const dim = getDimensionValue(u, dimensionField);
    if (!dim) continue;
    totals.set(dim, (totals.get(dim) ?? 0) + toNum(u.glam2));
  }

  // Occupied GLA per dimension per period
  const occupied = new Map<string, Map<string, number>>();
  for (const period of periods) {
    const { start, end } = periodBounds(period);
    const occupiedLocalIds = new Set<string>();
    for (const c of contracts) {
      if (isContractActiveInPeriod(c, start, end)) {
        occupiedLocalIds.add(c.localId);
      }
    }

    for (const localId of occupiedLocalIds) {
      const unit = unitById.get(localId);
      if (!unit) continue;
      const dim = getDimensionValue(unit, dimensionField);
      if (!dim) continue;

      const periodMap = occupied.get(dim) ?? new Map<string, number>();
      periodMap.set(period, (periodMap.get(period) ?? 0) + toNum(unit.glam2));
      occupied.set(dim, periodMap);
    }
  }

  return { occupied, totals };
}

/**
 * Computes total occupied GLA across all dimensions for a period.
 */
export function totalOccupiedGlaForPeriod(
  units: GlaUnitInput[],
  contracts: GlaContractInput[],
  period: string
): number {
  const glaUnits = units.filter((u) => u.esGLA);
  const unitById = new Map(glaUnits.map((u) => [u.id, u]));
  const { start, end } = periodBounds(period);

  const occupiedLocalIds = new Set<string>();
  for (const c of contracts) {
    if (isContractActiveInPeriod(c, start, end)) {
      occupiedLocalIds.add(c.localId);
    }
  }

  let total = 0;
  for (const localId of occupiedLocalIds) {
    const unit = unitById.get(localId);
    if (unit) total += toNum(unit.glam2);
  }
  return total;
}

/**
 * Generates the list of "YYYY-MM" period keys between two dates.
 */
export function generatePeriods(desdeDate: Date, hastaDate: Date): string[] {
  const periods: string[] = [];
  const current = new Date(desdeDate);
  while (current <= hastaDate) {
    periods.push(toPeriodKey(current));
    current.setMonth(current.getMonth() + 1);
  }
  return periods;
}
