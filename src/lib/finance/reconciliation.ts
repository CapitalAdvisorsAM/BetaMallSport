/**
 * Project-level reconciliation: expected billing (from contracts) vs
 * actual billing (from accounting records), aggregated per tenant.
 */

import { ContractRateType, ContractStatus } from "@prisma/client";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import {
  type DecimalLike,
  toNum,
  periodKey,
  isContractActiveInPeriod,
  shiftPeriod,
  calcExpectedIncome,
} from "@/lib/finance/billing-utils";

// ---------------------------------------------------------------------------
// Input types — raw Prisma data passed from the API route
// ---------------------------------------------------------------------------

export type ReconContract = {
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
  local: {
    id: string;
    codigo: string;
    nombre: string;
    glam2: DecimalLike;
  };
  arrendatario: {
    id: string;
    rut: string;
    nombreComercial: string;
  };
  tarifas: {
    tipo: ContractRateType;
    valor: DecimalLike;
    vigenciaDesde: Date;
    vigenciaHasta: Date | null;
    esDiciembre: boolean;
  }[];
  ggcc: {
    tarifaBaseUfM2: DecimalLike;
    pctAdministracion: DecimalLike;
    vigenciaDesde: Date;
    vigenciaHasta: Date | null;
  }[];
};

export type ReconAccountingRecord = {
  unitId: string | null;
  period: Date;
  group1: string;
  group3: string;
  valueUf: DecimalLike;
};

export type ReconTenantSale = {
  tenantId: string;
  period: Date;
  salesUf: DecimalLike;
};

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type ReconciliationTenantRow = {
  tenantId: string;
  rut: string;
  nombreComercial: string;
  locales: { codigo: string; nombre: string }[];
  glam2: number;
  expectedUf: number;
  expectedGgccUf: number;
  actualUf: number;
  actualGgccUf: number;
  gapUf: number;
  gapPct: number;
  gapGgccUf: number;
  gapGgccPct: number;
  /** Periods (YYYY-MM) where the tenant has a PORCENTAJE tarifa but no sales were reported for the lagged period. */
  missingSalesPeriods: string[];
};

export type ReconciliationSummary = {
  totalExpectedUf: number;
  totalActualUf: number;
  totalGapUf: number;
  totalGapPct: number;
  totalExpectedGgccUf: number;
  totalActualGgccUf: number;
  totalGapGgccUf: number;
  totalGapGgccPct: number;
  tenantsWithGapOver5: number;
  tenantsWithGapOver10: number;
  tenantCount: number;
};

export type ReconciliationResult = {
  rows: ReconciliationTenantRow[];
  summary: ReconciliationSummary;
};

const REVENUE_GROUP = "INGRESOS DE EXPLOTACION";
const GGCC_KEYWORDS = ["GASTO COMUN", "GASTOS COMUNES", "GGCC"];

function isGgccGroup3(group3: string): boolean {
  const upper = group3.toUpperCase();
  return GGCC_KEYWORDS.some((kw) => upper.includes(kw));
}

// ---------------------------------------------------------------------------
// Core: build reconciliation per tenant across all periods
// ---------------------------------------------------------------------------

export function buildReconciliation(
  contracts: ReconContract[],
  accountingRecords: ReconAccountingRecord[],
  sales: ReconTenantSale[],
  periods: string[]
): ReconciliationResult {
  // Index accounting by unitId
  const actualByUnit = new Map<string, number>();
  const actualGgccByUnit = new Map<string, number>();
  for (const r of accountingRecords) {
    if (!r.unitId) continue;
    if (r.group1 === REVENUE_GROUP) {
      const p = periodKey(r.period);
      // Only count records whose period is in our range
      if (periods.includes(p)) {
        actualByUnit.set(r.unitId, (actualByUnit.get(r.unitId) ?? 0) + toNum(r.valueUf));
        if (isGgccGroup3(r.group3)) {
          actualGgccByUnit.set(r.unitId, (actualGgccByUnit.get(r.unitId) ?? 0) + toNum(r.valueUf));
        }
      }
    }
  }

  // Index sales by tenant+period (no period filter — lag lookup needs M-1)
  const salesByTenantPeriod = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const p = periodKey(s.period);
    const tenantMap = salesByTenantPeriod.get(s.tenantId) ?? new Map<string, number>();
    tenantMap.set(p, (tenantMap.get(p) ?? 0) + toNum(s.salesUf));
    salesByTenantPeriod.set(s.tenantId, tenantMap);
  }

  // Group contracts by tenant
  const contractsByTenant = new Map<string, ReconContract[]>();
  for (const c of contracts) {
    const list = contractsByTenant.get(c.arrendatarioId) ?? [];
    list.push(c);
    contractsByTenant.set(c.arrendatarioId, list);
  }

  const rows: ReconciliationTenantRow[] = [];

  for (const [tenantId, tenantContracts] of contractsByTenant) {
    const firstContract = tenantContracts[0];
    const tenant = firstContract.arrendatario;

    // Unique locales
    const localesMap = new Map<string, { codigo: string; nombre: string }>();
    let totalGlam2 = 0;
    let totalExpectedUf = 0;
    let totalExpectedGgccUf = 0;
    let totalActualUf = 0;
    let totalActualGgccUf = 0;
    const missingSalesPeriods = new Set<string>();

    for (const c of tenantContracts) {
      localesMap.set(c.localId, { codigo: c.local.codigo, nombre: c.local.nombre });
      const glam2 = toNum(c.local.glam2);
      totalGlam2 += glam2;
      const hasPercentageRate = c.tarifas.some((t) => t.tipo === ContractRateType.PORCENTAJE);

      // Sum actual billing for this unit
      totalActualUf += actualByUnit.get(c.localId) ?? 0;
      totalActualGgccUf += actualGgccByUnit.get(c.localId) ?? 0;

      // Calculate expected across periods
      for (const period of periods) {
        const periodDate = new Date(`${period}-01`);
        if (!isContractActiveInPeriod(c, periodDate)) continue;

        const lagPeriod = shiftPeriod(period, -VARIABLE_RENT_LAG_MONTHS);
        const salesUf = salesByTenantPeriod.get(c.arrendatarioId)?.get(lagPeriod);
        if (hasPercentageRate && salesUf === undefined) {
          missingSalesPeriods.add(period);
        }

        const expected = calcExpectedIncome({
          tarifas: c.tarifas,
          ggcc: c.ggcc,
          glam2,
          multiplicadorDiciembre: c.multiplicadorDiciembre !== null ? toNum(c.multiplicadorDiciembre) : null,
          multiplicadorJunio: c.multiplicadorJunio !== null ? toNum(c.multiplicadorJunio) : null,
          multiplicadorJulio: c.multiplicadorJulio !== null ? toNum(c.multiplicadorJulio) : null,
          multiplicadorAgosto: c.multiplicadorAgosto !== null ? toNum(c.multiplicadorAgosto) : null,
          pctFondoPromocion: c.pctFondoPromocion !== null ? toNum(c.pctFondoPromocion) : null,
          periodDate,
          salesUf: salesUf ?? 0,
        });

        totalExpectedUf += expected.totalUf;
        totalExpectedGgccUf += expected.ggccUf;
      }
    }

    const gapUf = totalExpectedUf - totalActualUf;
    const gapPct = totalExpectedUf > 0 ? (gapUf / totalExpectedUf) * 100 : 0;
    const gapGgccUf = totalExpectedGgccUf - totalActualGgccUf;
    const gapGgccPct = totalExpectedGgccUf > 0 ? (gapGgccUf / totalExpectedGgccUf) * 100 : 0;

    rows.push({
      tenantId,
      rut: tenant.rut,
      nombreComercial: tenant.nombreComercial,
      locales: [...localesMap.values()],
      glam2: totalGlam2,
      expectedUf: totalExpectedUf,
      expectedGgccUf: totalExpectedGgccUf,
      actualUf: totalActualUf,
      actualGgccUf: totalActualGgccUf,
      gapUf,
      gapPct,
      gapGgccUf,
      gapGgccPct,
      missingSalesPeriods: [...missingSalesPeriods].sort()
    });
  }

  // Sort by gap magnitude descending
  rows.sort((a, b) => Math.abs(b.gapUf) - Math.abs(a.gapUf));

  const totalExpectedUf = rows.reduce((acc, r) => acc + r.expectedUf, 0);
  const totalActualUf = rows.reduce((acc, r) => acc + r.actualUf, 0);
  const totalGapUf = totalExpectedUf - totalActualUf;
  const totalExpectedGgccUf = rows.reduce((acc, r) => acc + r.expectedGgccUf, 0);
  const totalActualGgccUf = rows.reduce((acc, r) => acc + r.actualGgccUf, 0);
  const totalGapGgccUf = totalExpectedGgccUf - totalActualGgccUf;

  return {
    rows,
    summary: {
      totalExpectedUf,
      totalActualUf,
      totalGapUf,
      totalGapPct: totalExpectedUf > 0 ? (totalGapUf / totalExpectedUf) * 100 : 0,
      totalExpectedGgccUf,
      totalActualGgccUf,
      totalGapGgccUf,
      totalGapGgccPct: totalExpectedGgccUf > 0 ? (totalGapGgccUf / totalExpectedGgccUf) * 100 : 0,
      tenantsWithGapOver5: rows.filter((r) => Math.abs(r.gapPct) >= 5).length,
      tenantsWithGapOver10: rows.filter((r) => Math.abs(r.gapPct) >= 10).length,
      tenantCount: rows.length
    }
  };
}
