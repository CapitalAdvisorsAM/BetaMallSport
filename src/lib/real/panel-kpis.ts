import type { PanelCdgCell, PanelCdgKpi, PanelCdgUnit } from "@/types/panel-cdg";

/** Calcula YoY como % ((current - prior) / |prior|) * 100. Retorna null si prior es 0. */
export function yoyPct(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null) return null;
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

/** Division segura: retorna null cuando el denominador es 0 o negativo (superficies). */
export function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

type CellInput = {
  real: number | null;
  ppto?: number | null;
  prior?: number | null;
};

export function toPanelCell({ real, ppto, prior }: CellInput): PanelCdgCell {
  return {
    real,
    ppto: ppto ?? null,
    yoy: yoyPct(real, prior ?? null)
  };
}

type IncomeKpiInput = {
  mesReal: number | null;
  mesPpto: number | null;
  mesPrior: number | null;
  ytdReal: number | null;
  ytdPpto: number | null;
  ytdPrior: number | null;
};

/** Construye un KPI con unidad arbitraria (uf, m2, pct, uf_m2). */
export function buildPanelKpi(
  key: string,
  label: string,
  unit: PanelCdgUnit,
  input: IncomeKpiInput,
  section?: string | null
): PanelCdgKpi {
  return {
    key,
    label,
    unit,
    section: section ?? null,
    mes: toPanelCell({ real: input.mesReal, ppto: input.mesPpto, prior: input.mesPrior }),
    ytd: toPanelCell({ real: input.ytdReal, ppto: input.ytdPpto, prior: input.ytdPrior })
  };
}
