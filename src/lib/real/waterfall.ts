/**
 * Income Waterfall: decomposes income change between two periods into
 * categories (new contracts, lost contracts, rate changes, variable rent,
 * GGCC changes, and a residual "other" bucket).
 */

import { ContractDiscountType, ContractRateType, ContractStatus } from "@prisma/client";
import { ACCOUNTING_REVENUE_GROUP, VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import {
  type DecimalLike,
  toNum,
  periodKey,
  isContractActiveInPeriod,
  shiftPeriod,
  calcExpectedIncome,
  calcTieredVariableRent,
  extractVariableRentTiers,
  findRateForPeriod,
  findGgccForPeriod,
} from "@/lib/real/billing-utils";
import type {
  WaterfallBar,
  WaterfallCategory,
  WaterfallMode,
  WaterfallResponse,
} from "@/types/finance";

// ---------------------------------------------------------------------------
// Input types — raw Prisma data passed from the API route
// ---------------------------------------------------------------------------

export type WfContract = {
  id: string;
  localId: string;
  arrendatarioId: string;
  estado: ContractStatus;
  fechaInicio: Date;
  fechaTermino: Date;
  multiplicadorDiciembre: DecimalLike | null;
  multiplicadorJunio: DecimalLike | null;
  multiplicadorJulio: DecimalLike | null;
  multiplicadorAgosto: DecimalLike | null;
  pctFondoPromocion: DecimalLike | null;
  local: { id: string; glam2: DecimalLike };
  tarifas: {
    tipo: ContractRateType;
    valor: DecimalLike;
    umbralVentasUf?: DecimalLike | null;
    vigenciaDesde: Date;
    vigenciaHasta: Date | null;
    esDiciembre: boolean;
    descuentoTipo?: ContractDiscountType | null;
    descuentoValor?: DecimalLike | null;
    descuentoDesde?: Date | null;
    descuentoHasta?: Date | null;
  }[];
  ggcc: {
    tarifaBaseUfM2: DecimalLike;
    pctAdministracion: DecimalLike;
    vigenciaDesde: Date;
    vigenciaHasta: Date | null;
  }[];
};

export type WfAccountingRecord = {
  unitId: string | null;
  period: Date;
  group1: string;
  valueUf: DecimalLike;
};

export type WfTenantSale = {
  tenantId: string;
  period: Date;
  salesPesos: DecimalLike;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInPeriod(date: Date, period: string): boolean {
  return periodKey(date) === period;
}

const CATEGORY_LABELS: Record<WaterfallCategory, string> = {
  starting: "Ingreso anterior",
  new_contracts: "Nuevos contratos",
  lost_contracts: "Contratos perdidos",
  rate_changes: "Cambios de tarifa",
  variable_rent: "Renta variable",
  ggcc_changes: "GGCC",
  other: "Otros ajustes",
  ending: "Ingreso actual",
};

// ---------------------------------------------------------------------------
// Core: build waterfall
// ---------------------------------------------------------------------------

export function buildWaterfall(
  contracts: WfContract[],
  accountingRecords: WfAccountingRecord[],
  sales: WfTenantSale[],
  currentPeriod: string,
  previousPeriod: string,
  mode: WaterfallMode,
): WaterfallResponse {

  // 1. Starting income (from accounting records in previousPeriod)
  let startingIncome = 0;
  for (const r of accountingRecords) {
    if (r.group1 === ACCOUNTING_REVENUE_GROUP && periodKey(r.period) === previousPeriod) {
      startingIncome += toNum(r.valueUf);
    }
  }

  // 2. Ending income (from accounting records in currentPeriod)
  let endingIncome = 0;
  for (const r of accountingRecords) {
    if (r.group1 === ACCOUNTING_REVENUE_GROUP && periodKey(r.period) === currentPeriod) {
      endingIncome += toNum(r.valueUf);
    }
  }

  // 3. Index sales by tenant+period
  const salesByTenantPeriod = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const p = periodKey(s.period);
    const tenantMap =
      salesByTenantPeriod.get(s.tenantId) ?? new Map<string, number>();
    tenantMap.set(p, (tenantMap.get(p) ?? 0) + toNum(s.salesPesos));
    salesByTenantPeriod.set(s.tenantId, tenantMap);
  }

  function getSales(tenantId: string, period: string): number {
    const lagPeriod = shiftPeriod(period, -VARIABLE_RENT_LAG_MONTHS);
    return salesByTenantPeriod.get(tenantId)?.get(lagPeriod) ?? 0;
  }

  // 4. Classify contracts
  const currentDate = new Date(`${currentPeriod}-01`);
  const previousDate = new Date(`${previousPeriod}-01`);

  const newContracts: WfContract[] = [];
  const lostContracts: WfContract[] = [];
  const continuingContracts: WfContract[] = [];

  for (const c of contracts) {
    const activeInCurrent = isContractActiveInPeriod(c, currentDate);
    const activeInPrevious = isContractActiveInPeriod(c, previousDate);

    if (activeInCurrent && !activeInPrevious && isInPeriod(c.fechaInicio, currentPeriod)) {
      newContracts.push(c);
    } else if (activeInPrevious && !activeInCurrent) {
      lostContracts.push(c);
    } else if (activeInCurrent && activeInPrevious) {
      continuingContracts.push(c);
    }
  }

  // 5. New contracts delta
  let newContractsDelta = 0;
  for (const c of newContracts) {
    const glam2 = toNum(c.local.glam2);
    const salesUf = getSales(c.arrendatarioId, currentPeriod);
    const expected = calcExpectedIncome({
      tarifas: c.tarifas,
      ggcc: c.ggcc,
      glam2,
      multiplicadorDiciembre:
        c.multiplicadorDiciembre !== null
          ? toNum(c.multiplicadorDiciembre)
          : null,
      multiplicadorJunio:
        c.multiplicadorJunio !== null
          ? toNum(c.multiplicadorJunio)
          : null,
      multiplicadorJulio:
        c.multiplicadorJulio !== null
          ? toNum(c.multiplicadorJulio)
          : null,
      multiplicadorAgosto:
        c.multiplicadorAgosto !== null
          ? toNum(c.multiplicadorAgosto)
          : null,
      pctFondoPromocion:
        c.pctFondoPromocion !== null ? toNum(c.pctFondoPromocion) : null,
      periodDate: currentDate,
      salesUf,
      estado: c.estado,
    });
    newContractsDelta += expected.totalUf;
  }

  // 6. Lost contracts delta (negative)
  let lostContractsDelta = 0;
  for (const c of lostContracts) {
    const glam2 = toNum(c.local.glam2);
    const salesUf = getSales(c.arrendatarioId, previousPeriod);
    const expected = calcExpectedIncome({
      tarifas: c.tarifas,
      ggcc: c.ggcc,
      glam2,
      multiplicadorDiciembre:
        c.multiplicadorDiciembre !== null
          ? toNum(c.multiplicadorDiciembre)
          : null,
      multiplicadorJunio:
        c.multiplicadorJunio !== null
          ? toNum(c.multiplicadorJunio)
          : null,
      multiplicadorJulio:
        c.multiplicadorJulio !== null
          ? toNum(c.multiplicadorJulio)
          : null,
      multiplicadorAgosto:
        c.multiplicadorAgosto !== null
          ? toNum(c.multiplicadorAgosto)
          : null,
      pctFondoPromocion:
        c.pctFondoPromocion !== null ? toNum(c.pctFondoPromocion) : null,
      periodDate: previousDate,
      salesUf,
      estado: c.estado,
    });
    lostContractsDelta -= expected.totalUf;
  }

  // 7–9. Continuing contracts: rate changes, variable rent, GGCC
  let rateChangesDelta = 0;
  let variableRentDelta = 0;
  let ggccChangesDelta = 0;

  for (const c of continuingContracts) {
    const glam2 = toNum(c.local.glam2);

    // 7. Rate changes: check if any tarifa vigenciaDesde falls in currentPeriod
    const hasRateChange = c.tarifas.some(
      (t) => !t.esDiciembre && isInPeriod(t.vigenciaDesde, currentPeriod),
    );
    if (hasRateChange) {
      // New rate for currentPeriod
      const newRate = findRateForPeriod(c.tarifas, currentDate);
      // Old rate (what was in effect during previousPeriod)
      const oldRate = findRateForPeriod(c.tarifas, previousDate);

      let newFixedRent = 0;
      let oldFixedRent = 0;

      if (newRate) {
        if (newRate.tipo === ContractRateType.FIJO_UF_M2) {
          newFixedRent = toNum(newRate.valor) * glam2;
        } else if (newRate.tipo === ContractRateType.FIJO_UF) {
          newFixedRent = toNum(newRate.valor);
        }
      }
      if (oldRate) {
        if (oldRate.tipo === ContractRateType.FIJO_UF_M2) {
          oldFixedRent = toNum(oldRate.valor) * glam2;
        } else if (oldRate.tipo === ContractRateType.FIJO_UF) {
          oldFixedRent = toNum(oldRate.valor);
        }
      }

      rateChangesDelta += newFixedRent - oldFixedRent;
    }

    // 8. Variable rent delta (tiered)
    const tiers = extractVariableRentTiers(c.tarifas);
    if (tiers.length > 0) {
      const currentSales = getSales(c.arrendatarioId, currentPeriod);
      const previousSales = getSales(c.arrendatarioId, previousPeriod);

      const currentFixedRate = findRateForPeriod(c.tarifas, currentDate);
      const previousFixedRate = findRateForPeriod(c.tarifas, previousDate);

      let currentFixedRent = 0;
      if (currentFixedRate) {
        if (currentFixedRate.tipo === ContractRateType.FIJO_UF_M2) {
          currentFixedRent = toNum(currentFixedRate.valor) * glam2;
        } else if (currentFixedRate.tipo === ContractRateType.FIJO_UF) {
          currentFixedRent = toNum(currentFixedRate.valor);
        }
      }

      let previousFixedRent = 0;
      if (previousFixedRate) {
        if (previousFixedRate.tipo === ContractRateType.FIJO_UF_M2) {
          previousFixedRent = toNum(previousFixedRate.valor) * glam2;
        } else if (previousFixedRate.tipo === ContractRateType.FIJO_UF) {
          previousFixedRent = toNum(previousFixedRate.valor);
        }
      }

      const currentVarRent = calcTieredVariableRent(currentSales, tiers, currentFixedRent);
      const previousVarRent = calcTieredVariableRent(previousSales, tiers, previousFixedRent);

      variableRentDelta += currentVarRent - previousVarRent;
    }

    // 9. GGCC changes
    const currentGgcc = findGgccForPeriod(c.ggcc, currentDate);
    const previousGgcc = findGgccForPeriod(c.ggcc, previousDate);

    let currentGgccUf = 0;
    if (currentGgcc && currentGgcc.tarifaBaseUfM2 !== undefined) {
      const base = toNum(currentGgcc.tarifaBaseUfM2) * glam2;
      currentGgccUf =
        base + (toNum(currentGgcc.pctAdministracion) / 100) * base;
    }

    let previousGgccUf = 0;
    if (previousGgcc && previousGgcc.tarifaBaseUfM2 !== undefined) {
      const base = toNum(previousGgcc.tarifaBaseUfM2) * glam2;
      previousGgccUf =
        base + (toNum(previousGgcc.pctAdministracion) / 100) * base;
    }

    ggccChangesDelta += currentGgccUf - previousGgccUf;
  }

  // 10. Other (residual)
  const computedDeltas =
    newContractsDelta +
    lostContractsDelta +
    rateChangesDelta +
    variableRentDelta +
    ggccChangesDelta;
  const otherDelta = endingIncome - startingIncome - computedDeltas;

  // 11. Build bars
  const bars: WaterfallBar[] = [];
  let cumulative = startingIncome;

  bars.push({
    category: "starting",
    label: CATEGORY_LABELS.starting,
    value: startingIncome,
    cumulative: 0,
    isTotal: true,
  });

  const deltaCategories: { category: WaterfallCategory; delta: number }[] = [
    { category: "new_contracts", delta: newContractsDelta },
    { category: "lost_contracts", delta: lostContractsDelta },
    { category: "rate_changes", delta: rateChangesDelta },
    { category: "variable_rent", delta: variableRentDelta },
    { category: "ggcc_changes", delta: ggccChangesDelta },
    { category: "other", delta: otherDelta },
  ];

  for (const { category, delta } of deltaCategories) {
    bars.push({
      category,
      label: CATEGORY_LABELS[category],
      value: delta,
      cumulative,
      isTotal: false,
    });
    cumulative += delta;
  }

  bars.push({
    category: "ending",
    label: CATEGORY_LABELS.ending,
    value: endingIncome,
    cumulative: 0,
    isTotal: true,
  });

  const netChange = endingIncome - startingIncome;
  const netChangePct = startingIncome !== 0 ? (netChange / startingIncome) * 100 : 0;

  // GLA occupied in each period
  const glaArrendadaCurrent = [...newContracts, ...continuingContracts]
    .reduce((sum, c) => sum + toNum(c.local.glam2), 0);
  const glaArrendadaPrevious = [...lostContracts, ...continuingContracts]
    .reduce((sum, c) => sum + toNum(c.local.glam2), 0);

  return {
    mode,
    currentPeriod,
    previousPeriod,
    bars,
    currentTotal: endingIncome,
    previousTotal: startingIncome,
    netChange,
    netChangePct,
    glaArrendadaCurrent,
    glaArrendadaPrevious,
  };
}
