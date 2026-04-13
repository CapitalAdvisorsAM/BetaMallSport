/**
 * Budget vs Actual: expected income (from contracts + budgeted sales)
 * vs actual billed income (from accounting records), per tenant.
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
import type {
  BudgetVsActualResponse,
  BudgetVsActualMonthly,
  BudgetVsActualTenantRow,
  BudgetVsActualSummary,
} from "@/types/finance";

// ---------------------------------------------------------------------------
// Input types — raw Prisma data passed from the API route
// ---------------------------------------------------------------------------

export type BvaContract = {
  id: string;
  localId: string;
  arrendatarioId: string;
  estado: ContractStatus;
  fechaInicio: Date;
  fechaTermino: Date;
  multiplicadorDiciembre: DecimalLike | null;
  pctFondoPromocion: DecimalLike | null;
  local: { id: string; codigo: string; nombre: string; glam2: DecimalLike };
  arrendatario: { id: string; rut: string; nombreComercial: string };
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

export type BvaBudgetedSale = {
  tenantId: string;
  period: Date;
  salesUf: DecimalLike;
};

export type BvaAccountingRecord = {
  unitId: string | null;
  period: Date;
  group1: string;
  valueUf: DecimalLike;
};

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

const REVENUE_GROUP = "INGRESOS DE EXPLOTACION";

export function buildBudgetVsActual(
  contracts: BvaContract[],
  accountingRecords: BvaAccountingRecord[],
  budgetedSales: BvaBudgetedSale[],
  periods: string[]
): BudgetVsActualResponse {
  // Index actual billing by unitId+period
  const actualByUnitPeriod = new Map<string, Map<string, number>>();
  for (const r of accountingRecords) {
    if (!r.unitId) continue;
    if (r.group1 !== REVENUE_GROUP) continue;
    const p = periodKey(r.period);
    if (!periods.includes(p)) continue;
    const unitMap = actualByUnitPeriod.get(r.unitId) ?? new Map<string, number>();
    unitMap.set(p, (unitMap.get(p) ?? 0) + toNum(r.valueUf));
    actualByUnitPeriod.set(r.unitId, unitMap);
  }

  // Index budgeted sales by tenant+period (no period filter — lag needs M-1)
  const budgetSalesByTenantPeriod = new Map<string, Map<string, number>>();
  for (const s of budgetedSales) {
    const p = periodKey(s.period);
    const tenantMap = budgetSalesByTenantPeriod.get(s.tenantId) ?? new Map<string, number>();
    tenantMap.set(p, (tenantMap.get(p) ?? 0) + toNum(s.salesUf));
    budgetSalesByTenantPeriod.set(s.tenantId, tenantMap);
  }

  // Group contracts by tenant
  const contractsByTenant = new Map<string, BvaContract[]>();
  for (const c of contracts) {
    const list = contractsByTenant.get(c.arrendatarioId) ?? [];
    list.push(c);
    contractsByTenant.set(c.arrendatarioId, list);
  }

  // Accumulators for monthly aggregation
  const monthlyBudget = new Map<string, number>();
  const monthlyActual = new Map<string, number>();

  const rows: BudgetVsActualTenantRow[] = [];

  for (const [tenantId, tenantContracts] of contractsByTenant) {
    const tenant = tenantContracts[0].arrendatario;
    const localesMap = new Map<string, { codigo: string; nombre: string }>();
    let totalGlam2 = 0;
    let totalBudgetUf = 0;
    let totalActualUf = 0;

    for (const c of tenantContracts) {
      localesMap.set(c.localId, { codigo: c.local.codigo, nombre: c.local.nombre });
      const glam2 = toNum(c.local.glam2);
      totalGlam2 += glam2;

      for (const period of periods) {
        const periodDate = new Date(`${period}-01`);
        if (!isContractActiveInPeriod(c, periodDate)) continue;

        const lagPeriod = shiftPeriod(period, -VARIABLE_RENT_LAG_MONTHS);
        const salesUf = budgetSalesByTenantPeriod.get(c.arrendatarioId)?.get(lagPeriod);

        const expected = calcExpectedIncome({
          tarifas: c.tarifas,
          ggcc: c.ggcc,
          glam2,
          multiplicadorDiciembre: c.multiplicadorDiciembre !== null ? toNum(c.multiplicadorDiciembre) : null,
          pctFondoPromocion: c.pctFondoPromocion !== null ? toNum(c.pctFondoPromocion) : null,
          periodDate,
          salesUf: salesUf ?? 0,
        });

        totalBudgetUf += expected.totalUf;
        monthlyBudget.set(period, (monthlyBudget.get(period) ?? 0) + expected.totalUf);

        const unitActual = actualByUnitPeriod.get(c.localId)?.get(period) ?? 0;
        totalActualUf += unitActual;
        monthlyActual.set(period, (monthlyActual.get(period) ?? 0) + unitActual);
      }
    }

    const varianceUf = totalBudgetUf - totalActualUf;
    const variancePct = totalBudgetUf > 0 ? (varianceUf / totalBudgetUf) * 100 : 0;
    const achievementPct = totalBudgetUf > 0 ? (totalActualUf / totalBudgetUf) * 100 : 0;

    rows.push({
      tenantId,
      rut: tenant.rut,
      nombreComercial: tenant.nombreComercial,
      locales: [...localesMap.values()],
      glam2: totalGlam2,
      budgetUf: totalBudgetUf,
      actualUf: totalActualUf,
      varianceUf,
      variancePct,
      achievementPct,
    });
  }

  // Sort by |varianceUf| descending
  rows.sort((a, b) => Math.abs(b.varianceUf) - Math.abs(a.varianceUf));

  // Monthly aggregation
  const monthly: BudgetVsActualMonthly[] = periods.map((period) => {
    const budget = monthlyBudget.get(period) ?? 0;
    const actual = monthlyActual.get(period) ?? 0;
    const variance = budget - actual;
    return {
      period,
      budgetUf: budget,
      actualUf: actual,
      varianceUf: variance,
      variancePct: budget > 0 ? (variance / budget) * 100 : 0,
      achievementPct: budget > 0 ? (actual / budget) * 100 : 0,
    };
  });

  // Summary
  const totalBudgetUf = rows.reduce((acc, r) => acc + r.budgetUf, 0);
  const totalActualUf = rows.reduce((acc, r) => acc + r.actualUf, 0);
  const totalVarianceUf = totalBudgetUf - totalActualUf;

  const summary: BudgetVsActualSummary = {
    totalBudgetUf,
    totalActualUf,
    totalVarianceUf,
    totalVariancePct: totalBudgetUf > 0 ? (totalVarianceUf / totalBudgetUf) * 100 : 0,
    totalAchievementPct: totalBudgetUf > 0 ? (totalActualUf / totalBudgetUf) * 100 : 0,
    tenantsOverBudget: rows.filter((r) => r.actualUf > r.budgetUf).length,
    tenantsUnderBudget: rows.filter((r) => r.actualUf < r.budgetUf).length,
    tenantCount: rows.length,
  };

  return { periods, monthly, rows, summary };
}
