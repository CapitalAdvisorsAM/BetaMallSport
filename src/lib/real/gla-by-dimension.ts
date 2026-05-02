/**
 * Shared helper: computes occupied GLA per dimension bucket per period.
 * Used by occupancy, facturacion, ventas, and GGCC features.
 */

import { UnitType } from "@prisma/client";
import { mapCategoria } from "@/lib/kpi";
import { toPeriodKey } from "@/lib/real/period-range";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type DecimalLike = number | string | { toString(): string };

export type GlaUnitInput = {
  id: string;
  codigo?: string;
  nombre?: string | null;
  tipo: UnitType;
  esGLA: boolean;
  glam2: DecimalLike;
  piso: string;
  categoriaTamano?: string | null;
  zona?: string | null;
};

export type GlaContractInput = {
  localId: string;
  fechaInicio: Date;
  fechaTermino: Date;
};

export type DimensionField = "tipo" | "tamano" | "piso" | "zona" | "rubro";

/**
 * Map of unitId → rubro label, derived from active contracts joined to tenants.
 * Required when computing GLA / sales by `rubro`, since rubro lives on Tenant
 * (not Unit). Build it once per request from the same contracts payload and
 * pass it into `buildGlaByDimensionPeriod`.
 */
export type TenantRubroByUnitId = Map<string, string | null>;

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
  const categoriaTamano = normalizeTamanoLabel(unit.categoriaTamano);
  if (categoriaTamano) return categoriaTamano;

  if (unit.tipo === UnitType.BODEGA) return "Bodega";
  if (unit.tipo === UnitType.MODULO || unit.tipo === UnitType.SIMULADOR) return "Modulo";
  const gla = toNum(unit.glam2);
  if (gla > 200) return "Tienda Mayor";
  if (gla >= 50) return "Tienda Mediana";
  return "Tienda Menor";
}

function normalizeTamanoLabel(value: string | null | undefined): TamanoLabel | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const map: Record<string, TamanoLabel> = {
    TIENDAMAYOR: "Tienda Mayor",
    TIENDAMEDIANA: "Tienda Mediana",
    TIENDAMENOR: "Tienda Menor",
    MODULO: "Modulo",
    BODEGA: "Bodega"
  };
  return map[normalized] ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function getDimensionValue(
  unit: GlaUnitInput,
  field: DimensionField,
  tenantRubroByUnitId?: TenantRubroByUnitId
): string | null {
  if (field === "tipo") return mapCategoria(unit.zona);
  if (field === "tamano") return mapTamanoFromUnit(unit);
  if (field === "zona") return unit.zona?.trim() || null;
  if (field === "rubro") return tenantRubroByUnitId?.get(unit.id) ?? null;
  return unit.piso || null;
}

function isContractActiveAtPeriodEnd(c: GlaContractInput, periodEnd: Date): boolean {
  return c.fechaInicio <= periodEnd && c.fechaTermino >= periodEnd;
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
  dimensionField: DimensionField,
  tenantRubroByUnitId?: TenantRubroByUnitId
): {
  occupied: Map<string, Map<string, number>>;
  totals: Map<string, number>;
} {
  const glaUnits = units.filter((u) => u.esGLA);
  const unitById = new Map(glaUnits.map((u) => [u.id, u]));

  // Total GLA per dimension (static across periods).
  // For "rubro", the assignment depends on the active tenant which can change
  // over time, so a static total is meaningless — fall back to occupied totals.
  const totals = new Map<string, number>();
  if (dimensionField !== "rubro") {
    for (const u of glaUnits) {
      const dim = getDimensionValue(u, dimensionField, tenantRubroByUnitId);
      if (!dim) continue;
      totals.set(dim, (totals.get(dim) ?? 0) + toNum(u.glam2));
    }
  }

  // Occupied GLA per dimension per period
  const occupied = new Map<string, Map<string, number>>();
  for (const period of periods) {
    const { end } = periodBounds(period);
    const occupiedLocalIds = new Set<string>();
    for (const c of contracts) {
      if (isContractActiveAtPeriodEnd(c, end)) {
        occupiedLocalIds.add(c.localId);
      }
    }

    for (const localId of occupiedLocalIds) {
      const unit = unitById.get(localId);
      if (!unit) continue;
      const dim = getDimensionValue(unit, dimensionField, tenantRubroByUnitId);
      if (!dim) continue;

      const periodMap = occupied.get(dim) ?? new Map<string, number>();
      periodMap.set(period, (periodMap.get(period) ?? 0) + toNum(unit.glam2));
      occupied.set(dim, periodMap);
    }
  }

  // For rubro: derive totals from the max occupied GLA per dimension across periods.
  // Conservative: best snapshot of "how much GLA this rubro currently holds".
  if (dimensionField === "rubro") {
    for (const [dim, periodMap] of occupied) {
      let maxGla = 0;
      for (const v of periodMap.values()) maxGla = Math.max(maxGla, v);
      totals.set(dim, maxGla);
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
  const { end } = periodBounds(period);

  const occupiedLocalIds = new Set<string>();
  for (const c of contracts) {
    if (isContractActiveAtPeriodEnd(c, end)) {
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
