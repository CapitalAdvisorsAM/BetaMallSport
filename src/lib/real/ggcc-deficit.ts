/**
 * Builds GGCC deficit analysis (recovery vs operating costs).
 * Replicates CDG Excel "GG.CC." sheet logic.
 */

import type {
  GgccCostBreakdown,
  GgccDeficitByDimension,
  GgccDeficitPeriodRow,
  GgccDeficitResponse
} from "@/types/ggcc-deficit";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type DecimalLike = number | string | { toString(): string };

export type GgccRecordInput = {
  period: Date;
  group1: string;
  group3: string;
  valueUf: DecimalLike;
  sizeCategory: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function pKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function normalizeLabel(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function classifyCost(group3: string): keyof GgccCostBreakdown | null {
  const n = normalizeLabel(group3);
  if (n.includes("CONTRIBUCION")) return "contribuciones";
  if (n.includes("MANO DE OBRA") || n.includes("PERSONAL")) return "manoDeObra";
  if (n.includes("GASTOS ADMINISTRACION") || n.includes("ADMINISTRACION")) return "gastosAdmin";
  if (n.includes("OPERACION") || n.includes("GASTOS OPERACIONES")) return "gastosOperaciones";
  return null;
}

function isRecovery(group3: string): boolean {
  return normalizeLabel(group3).includes("RECUPERACION GASTOS COMUNES");
}

function emptyBreakdown(): GgccCostBreakdown {
  return { contribuciones: 0, gastosOperaciones: 0, manoDeObra: 0, gastosAdmin: 0, total: 0 };
}

// ---------------------------------------------------------------------------
// Single-bucket builder
// ---------------------------------------------------------------------------

function buildDeficitRows(
  recoveryByPeriod: Map<string, number>,
  costByPeriod: Map<string, GgccCostBreakdown>,
  glaByPeriod: Map<string, number>,
  periods: string[]
): GgccDeficitPeriodRow[] {
  return periods.map((p) => {
    const recoveryUf = recoveryByPeriod.get(p) ?? 0;
    const cost = costByPeriod.get(p) ?? emptyBreakdown();
    const costUf = cost.total;
    const costMagnitudeUf = Math.abs(costUf);
    const deficitUf = recoveryUf - costMagnitudeUf;
    const deficitPct = recoveryUf !== 0 ? (deficitUf / Math.abs(recoveryUf)) * 100 : 0;
    const gla = glaByPeriod.get(p) ?? 0;

    return {
      period: p,
      recoveryUf,
      costUf,
      deficitUf,
      deficitPct,
      costBreakdown: cost,
      recoveryUfM2: gla > 0 ? recoveryUf / gla : 0,
      costUfM2: gla > 0 ? costUf / gla : 0,
      deficitUfM2: gla > 0 ? deficitUf / gla : 0
    };
  });
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildGgccDeficit(
  records: GgccRecordInput[],
  incomeRecords: GgccRecordInput[],
  totalGlaByPeriod: Map<string, number>,
  periods: string[]
): GgccDeficitResponse {
  // Overall aggregation
  const overallRecovery = new Map<string, number>();
  const overallCost = new Map<string, GgccCostBreakdown>();

  // By size category aggregation
  const bySizeRecovery = new Map<string, Map<string, number>>();
  const bySizeCost = new Map<string, Map<string, GgccCostBreakdown>>();
  const bySizeGla = new Map<string, Map<string, number>>();

  for (const r of records) {
    const p = pKey(r.period);
    const val = toNum(r.valueUf);

    if (isRecovery(r.group3)) {
      // Recovery
      overallRecovery.set(p, (overallRecovery.get(p) ?? 0) + val);

      if (r.sizeCategory) {
        const dimMap = bySizeRecovery.get(r.sizeCategory) ?? new Map<string, number>();
        dimMap.set(p, (dimMap.get(p) ?? 0) + val);
        bySizeRecovery.set(r.sizeCategory, dimMap);
      }
    } else {
      // Cost
      const cat = classifyCost(r.group3);
      if (!cat) continue;

      const entry = overallCost.get(p) ?? emptyBreakdown();
      entry[cat] += val;
      entry.total += val;
      overallCost.set(p, entry);

      if (r.sizeCategory) {
        const dimCostMap = bySizeCost.get(r.sizeCategory) ?? new Map<string, GgccCostBreakdown>();
        const dimEntry = dimCostMap.get(p) ?? emptyBreakdown();
        dimEntry[cat] += val;
        dimEntry.total += val;
        dimCostMap.set(p, dimEntry);
        bySizeCost.set(r.sizeCategory, dimCostMap);
      }
    }
  }

  // Overall rows
  const overall = buildDeficitRows(overallRecovery, overallCost, totalGlaByPeriod, periods);

  // By-size rows
  const allSizes = new Set([...bySizeRecovery.keys(), ...bySizeCost.keys()]);
  const bySize: GgccDeficitByDimension[] = [...allSizes].sort().map((dim) => ({
    dimension: dim,
    rows: buildDeficitRows(
      bySizeRecovery.get(dim) ?? new Map(),
      bySizeCost.get(dim) ?? new Map(),
      bySizeGla.get(dim) ?? totalGlaByPeriod,
      periods
    )
  }));

  // Mano de Obra / Ingresos ratio
  const incomeByPeriod = new Map<string, number>();
  for (const r of incomeRecords) {
    const p = pKey(r.period);
    incomeByPeriod.set(p, (incomeByPeriod.get(p) ?? 0) + toNum(r.valueUf));
  }

  const manoDeObraIngresosRatio: Record<string, number> = {};
  for (const p of periods) {
    const mdo = overallCost.get(p)?.manoDeObra ?? 0;
    const income = incomeByPeriod.get(p) ?? 0;
    manoDeObraIngresosRatio[p] = income !== 0 ? (mdo / income) * 100 : 0;
  }

  return { periods, overall, bySize, manoDeObraIngresosRatio };
}
