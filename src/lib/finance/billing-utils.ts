/**
 * Shared low-level helpers used by both gap analysis (tenant-360.ts) and
 * reconciliation (reconciliation.ts). Extracted to avoid duplication.
 */

import { ContractRateType, ContractStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type DecimalLike = number | string | { toString(): string };

export type RateEntry = {
  tipo: ContractRateType;
  valor: DecimalLike;
  umbralVentasUf?: DecimalLike | null;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
  esDiciembre: boolean;
};

export type GgccEntry = {
  tarifaBaseUfM2?: DecimalLike;
  pctAdministracion?: DecimalLike;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
};

type ContractEntry = {
  estado: ContractStatus;
  fechaInicio: Date;
  fechaTermino: Date;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toNum(value: DecimalLike | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export function periodKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function findRateForPeriod<T extends RateEntry>(tarifas: T[], periodDate: Date): T | null {
  const nonDec = tarifas
    .filter((t) => !t.esDiciembre)
    .sort((a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime());

  for (const t of nonDec) {
    if (t.vigenciaDesde <= periodDate && (!t.vigenciaHasta || t.vigenciaHasta >= periodDate)) {
      return t;
    }
  }
  // Fallback: most recent rate that started before the period
  for (const t of nonDec) {
    if (t.vigenciaDesde <= periodDate) return t;
  }
  return null;
}

export function findDecemberRate<T extends RateEntry>(tarifas: T[], periodDate: Date): T | null {
  const decRates = tarifas
    .filter((t) => t.esDiciembre)
    .sort((a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime());

  for (const t of decRates) {
    if (t.vigenciaDesde <= periodDate && (!t.vigenciaHasta || t.vigenciaHasta >= periodDate)) {
      return t;
    }
  }
  return decRates[0] ?? null;
}

export function findGgccForPeriod<T extends GgccEntry>(ggccList: T[], periodDate: Date): T | null {
  const sorted = [...ggccList].sort((a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime());

  for (const g of sorted) {
    if (g.vigenciaDesde <= periodDate && (!g.vigenciaHasta || g.vigenciaHasta >= periodDate)) {
      return g;
    }
  }
  for (const g of sorted) {
    if (g.vigenciaDesde <= periodDate) return g;
  }
  return null;
}

/**
 * Shift a "YYYY-MM" period string by `months` (positive = forward, negative = backward).
 * Handles year rollover (e.g. "2025-01" shifted by -1 → "2024-12").
 */
export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

/**
 * Tiered variable rent (retroactive/threshold-based):
 * Find the HIGHEST threshold that sales exceed, then apply that tier's
 * percentage to ALL sales. Subtract fixed rent.
 *
 * Example: tiers = [{umbralVentasUf: 0, pct: 5}, {umbralVentasUf: 1000, pct: 7}]
 * Sales 1500 → 7% × 1500 - fixedRent
 */
export function calcTieredVariableRent(
  salesUf: number,
  tiers: Array<{ umbralVentasUf: number; pct: number }>,
  fixedRentUf: number,
): number {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.umbralVentasUf - a.umbralVentasUf);
  const tier = sorted.find((t) => salesUf >= t.umbralVentasUf);
  if (!tier) return 0;
  return Math.max(0, salesUf * (tier.pct / 100) - fixedRentUf);
}

/**
 * Variable rent = MAX(0, salesUf × pctVariable / 100 − fixedRentUf).
 * Convenience wrapper for single-tier (backward compatible).
 */
export function calcVariableRent(
  salesUf: number,
  pctVariable: number,
  fixedRentUf: number,
): number {
  return calcTieredVariableRent(salesUf, [{ umbralVentasUf: 0, pct: pctVariable }], fixedRentUf);
}

/**
 * Extract variable rent tiers from a list of rate entries (PORCENTAJE type).
 */
export function extractVariableRentTiers(
  tarifas: RateEntry[],
): Array<{ umbralVentasUf: number; pct: number }> {
  return tarifas
    .filter((t) => t.tipo === ContractRateType.PORCENTAJE)
    .map((t) => ({
      umbralVentasUf: toNum(t.umbralVentasUf),
      pct: toNum(t.valor),
    }));
}

// ---------------------------------------------------------------------------
// Expected income per contract per period
// ---------------------------------------------------------------------------

export type ExpectedIncomeResult = {
  fixedRentUf: number;
  ggccUf: number;
  fondoUf: number;
  variableRentUf: number;
  totalUf: number;
};

/**
 * Calculate expected income for a single contract in a single period.
 * Combines fixed rent, GGCC, fondo de promoción, and variable rent.
 */
export function calcExpectedIncome(params: {
  tarifas: RateEntry[];
  ggcc: GgccEntry[];
  glam2: number;
  multiplicadorDiciembre: number | null;
  multiplicadorJunio: number | null;
  multiplicadorAgosto: number | null;
  pctFondoPromocion: number | null;
  periodDate: Date;
  salesUf?: number;
}): ExpectedIncomeResult {
  const { tarifas, ggcc, glam2, multiplicadorDiciembre, multiplicadorJunio, multiplicadorAgosto, pctFondoPromocion, periodDate, salesUf } = params;
  const monthIndex = periodDate.getUTCMonth();
  const multiplier =
    monthIndex === 5 ? multiplicadorJunio :
    monthIndex === 7 ? multiplicadorAgosto :
    monthIndex === 11 ? multiplicadorDiciembre :
    null;
  const isDecember = monthIndex === 11;

  // Fixed rent
  let fixedRentUf = 0;
  if (isDecember && multiplier !== null) {
    // December: check for esDiciembre-specific tariff first
    const decRate = findDecemberRate(tarifas, periodDate);
    if (decRate) {
      if (decRate.tipo === ContractRateType.FIJO_UF_M2) fixedRentUf = toNum(decRate.valor) * glam2;
      else if (decRate.tipo === ContractRateType.FIJO_UF) fixedRentUf = toNum(decRate.valor);
    } else {
      const regularRate = findRateForPeriod(tarifas, periodDate);
      if (regularRate) {
        if (regularRate.tipo === ContractRateType.FIJO_UF_M2) fixedRentUf = toNum(regularRate.valor) * glam2 * multiplier;
        else if (regularRate.tipo === ContractRateType.FIJO_UF) fixedRentUf = toNum(regularRate.valor) * multiplier;
      }
    }
  } else if (multiplier !== null) {
    // June or August: apply multiplier to regular tariff
    const rate = findRateForPeriod(tarifas, periodDate);
    if (rate) {
      if (rate.tipo === ContractRateType.FIJO_UF_M2) fixedRentUf = toNum(rate.valor) * glam2 * multiplier;
      else if (rate.tipo === ContractRateType.FIJO_UF) fixedRentUf = toNum(rate.valor) * multiplier;
    }
  } else {
    const rate = findRateForPeriod(tarifas, periodDate);
    if (rate) {
      if (rate.tipo === ContractRateType.FIJO_UF_M2) fixedRentUf = toNum(rate.valor) * glam2;
      else if (rate.tipo === ContractRateType.FIJO_UF) fixedRentUf = toNum(rate.valor);
    }
  }

  // GGCC
  let ggccUf = 0;
  const ggccEntry = findGgccForPeriod(ggcc, periodDate);
  if (ggccEntry && ggccEntry.tarifaBaseUfM2 !== undefined) {
    const base = toNum(ggccEntry.tarifaBaseUfM2) * glam2;
    ggccUf = base + (toNum(ggccEntry.pctAdministracion) / 100) * base;
  }

  // Fondo de promoción
  let fondoUf = 0;
  const pctFondo = pctFondoPromocion ?? 0;
  if (pctFondo > 0) {
    fondoUf = fixedRentUf * (pctFondo / 100);
  }

  // Variable rent (tiered)
  let variableRentUf = 0;
  if (salesUf !== undefined) {
    const tiers = extractVariableRentTiers(tarifas);
    if (tiers.length > 0) {
      variableRentUf = calcTieredVariableRent(salesUf, tiers, fixedRentUf);
    }
  }

  return {
    fixedRentUf,
    ggccUf,
    fondoUf,
    variableRentUf,
    totalUf: fixedRentUf + ggccUf + fondoUf + variableRentUf,
  };
}

export function isContractActiveInPeriod<T extends ContractEntry>(contract: T, periodDate: Date): boolean {
  if (contract.estado === ContractStatus.TERMINADO || contract.estado === ContractStatus.TERMINADO_ANTICIPADO) {
    return contract.fechaTermino >= periodDate;
  }
  return contract.fechaInicio <= periodDate;
}
