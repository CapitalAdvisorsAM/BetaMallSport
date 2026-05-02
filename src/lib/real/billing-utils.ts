/**
 * Shared low-level helpers used by both gap analysis (tenant-360.ts) and
 * reconciliation (reconciliation.ts). Extracted to avoid duplication.
 */

import { ContractRateType, ContractStatus, ContractDiscountType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type DecimalLike = number | string | { toString(): string };

export type RateEntry = {
  tipo: ContractRateType;
  valor: DecimalLike;
  umbralVentasUf?: DecimalLike | null;
  pisoMinimoUf?: DecimalLike | null;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
  esDiciembre: boolean;
  descuentoTipo?: ContractDiscountType | null;
  descuentoValor?: DecimalLike | null;
  descuentoDesde?: Date | null;
  descuentoHasta?: Date | null;
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

export { toPeriodKey as periodKey } from "@/lib/real/period-range";

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

/**
 * Compute effective tariff value for a period, applying discount if the period
 * falls within the discount window.
 * - PORCENTAJE: valor * (1 - descuentoValor)
 * - MONTO_UF:   valor - descuentoValor
 * Returns the base valor when no discount applies.
 */
export function computeEffectiveRate(rate: RateEntry, periodDate: Date): number {
  const baseValor = toNum(rate.valor);

  if (!rate.descuentoTipo || rate.descuentoValor === null || rate.descuentoValor === undefined) {
    return baseValor;
  }

  if (rate.descuentoDesde && periodDate < rate.descuentoDesde) {
    return baseValor;
  }
  if (rate.descuentoHasta && periodDate > rate.descuentoHasta) {
    return baseValor;
  }

  const descValor = toNum(rate.descuentoValor);
  if (rate.descuentoTipo === ContractDiscountType.PORCENTAJE) {
    return baseValor * (1 - descValor);
  }
  if (rate.descuentoTipo === ContractDiscountType.MONTO_UF) {
    return Math.max(0, baseValor - descValor);
  }
  return baseValor;
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
 * When the selected tier has `pisoMinimoUf`, guarantee that the tenant pays at least
 * `pisoMinimoUf` in total each month:
 *   totalRent = max(fixedRent + variable, pisoMinimoUf)
 *   => minVariable = max(0, pisoMinimoUf - fixedRent)
 *   => return max(variableOverFixed, minVariable)
 *
 * Example: tiers = [{umbralVentasUf: 0, pct: 5}, {umbralVentasUf: 1000, pct: 7}]
 * Sales 1500 → 7% × 1500 - fixedRent
 */
export function calcTieredVariableRent(
  salesUf: number,
  tiers: Array<{ umbralVentasUf: number; pct: number; pisoMinimoUf?: number | null }>,
  fixedRentUf: number,
): number {
  if (tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.umbralVentasUf - a.umbralVentasUf);
  const tier = sorted.find((t) => salesUf >= t.umbralVentasUf);
  if (!tier) return 0;
  const variableOverFixed = Math.max(0, salesUf * (tier.pct / 100) - fixedRentUf);
  if (tier.pisoMinimoUf !== null && tier.pisoMinimoUf !== undefined && tier.pisoMinimoUf > 0) {
    const minVariable = Math.max(0, tier.pisoMinimoUf - fixedRentUf);
    return Math.max(variableOverFixed, minVariable);
  }
  return variableOverFixed;
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
): Array<{ umbralVentasUf: number; pct: number; pisoMinimoUf: number | null }> {
  return tarifas
    .filter((t) => t.tipo === ContractRateType.PORCENTAJE)
    .map((t) => ({
      umbralVentasUf: toNum(t.umbralVentasUf),
      pct: toNum(t.valor),
      pisoMinimoUf:
        t.pisoMinimoUf === null || t.pisoMinimoUf === undefined ? null : toNum(t.pisoMinimoUf),
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
  multiplicadorJulio: number | null;
  multiplicadorAgosto: number | null;
  pctFondoPromocion: number | null;
  periodDate: Date;
  salesUf?: number;
  estado?: ContractStatus;
}): ExpectedIncomeResult {
  const { tarifas, ggcc, glam2, multiplicadorDiciembre, multiplicadorJunio, multiplicadorJulio, multiplicadorAgosto, pctFondoPromocion, periodDate, salesUf, estado } = params;

  if (estado === ContractStatus.GRACIA) {
    return { fixedRentUf: 0, ggccUf: 0, fondoUf: 0, variableRentUf: 0, totalUf: 0 };
  }

  const monthIndex = periodDate.getUTCMonth();
  const multiplier =
    monthIndex === 5 ? multiplicadorJunio :
    monthIndex === 6 ? multiplicadorJulio :
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
      const effective = computeEffectiveRate(decRate, periodDate);
      if (decRate.tipo === ContractRateType.FIJO_UF_M2) fixedRentUf = effective * glam2;
      else if (decRate.tipo === ContractRateType.FIJO_UF) fixedRentUf = effective;
    } else {
      const regularRate = findRateForPeriod(tarifas, periodDate);
      if (regularRate) {
        const effective = computeEffectiveRate(regularRate, periodDate);
        if (regularRate.tipo === ContractRateType.FIJO_UF_M2) fixedRentUf = effective * glam2 * multiplier;
        else if (regularRate.tipo === ContractRateType.FIJO_UF) fixedRentUf = effective * multiplier;
      }
    }
  } else if (multiplier !== null) {
    // June, July or August: apply multiplier to regular tariff
    const rate = findRateForPeriod(tarifas, periodDate);
    if (rate) {
      const effective = computeEffectiveRate(rate, periodDate);
      if (rate.tipo === ContractRateType.FIJO_UF_M2) fixedRentUf = effective * glam2 * multiplier;
      else if (rate.tipo === ContractRateType.FIJO_UF) fixedRentUf = effective * multiplier;
    }
  } else {
    const rate = findRateForPeriod(tarifas, periodDate);
    if (rate) {
      const effective = computeEffectiveRate(rate, periodDate);
      if (rate.tipo === ContractRateType.FIJO_UF_M2) fixedRentUf = effective * glam2;
      else if (rate.tipo === ContractRateType.FIJO_UF) fixedRentUf = effective;
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
