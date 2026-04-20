import { ContractStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { periodKey, shiftPeriod, toNum, type DecimalLike } from "@/lib/finance/billing-utils";

export type TenantInfo = {
  id: string;
  rut: string;
  nombreComercial: string;
};

export type BudgetedSaleMatrixInput = {
  tenantId: string;
  period: Date;
  salesUf: DecimalLike;
};

export type BudgetedSalesMatrixRow = {
  tenantId: string;
  rut: string;
  nombreComercial: string;
  glam2: number;
  byPeriod: Record<string, number | null>;
  total: number;
  missingPeriods: string[];
};

export type BudgetedSalesMatrixSummary = {
  totalBudgetUf: number;
  tenantsWithData: number;
  tenantsWithMissing: number;
};

export type BudgetedSalesMatrixResponse = {
  periods: string[];
  rows: BudgetedSalesMatrixRow[];
  summary: BudgetedSalesMatrixSummary;
};

export function buildPeriodRange(desde: string, hasta: string): string[] {
  if (desde > hasta) return [];
  const periods: string[] = [];
  let current = desde;
  while (current <= hasta) {
    periods.push(current);
    current = shiftPeriod(current, 1);
  }
  return periods;
}

export function periodToDate(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function buildBudgetedSalesMatrix(params: {
  budgetedSales: BudgetedSaleMatrixInput[];
  tenantsById: Map<string, TenantInfo>;
  glaByTenantId: Map<string, number>;
  periods: string[];
}): BudgetedSalesMatrixResponse {
  const { budgetedSales, tenantsById, glaByTenantId, periods } = params;
  const periodSet = new Set(periods);

  const byTenantPeriod = new Map<string, Map<string, number>>();
  for (const sale of budgetedSales) {
    const pKey = periodKey(sale.period);
    if (!periodSet.has(pKey)) continue;
    const tenantMap = byTenantPeriod.get(sale.tenantId) ?? new Map<string, number>();
    tenantMap.set(pKey, (tenantMap.get(pKey) ?? 0) + toNum(sale.salesUf));
    byTenantPeriod.set(sale.tenantId, tenantMap);
  }

  const rows: BudgetedSalesMatrixRow[] = [];
  let totalBudgetUf = 0;
  let tenantsWithData = 0;
  let tenantsWithMissing = 0;

  for (const info of tenantsById.values()) {
    const periodMap = byTenantPeriod.get(info.id) ?? new Map<string, number>();

    const byPeriod: Record<string, number | null> = {};
    const missingPeriods: string[] = [];
    let total = 0;
    let filledCount = 0;

    for (const p of periods) {
      if (periodMap.has(p)) {
        const value = periodMap.get(p) ?? 0;
        byPeriod[p] = value;
        total += value;
        filledCount += 1;
      } else {
        byPeriod[p] = null;
        missingPeriods.push(p);
      }
    }

    if (filledCount > 0) tenantsWithData += 1;
    if (filledCount > 0 && missingPeriods.length > 0) tenantsWithMissing += 1;
    totalBudgetUf += total;

    rows.push({
      tenantId: info.id,
      rut: info.rut,
      nombreComercial: info.nombreComercial,
      glam2: glaByTenantId.get(info.id) ?? 0,
      byPeriod,
      total,
      missingPeriods,
    });
  }

  rows.sort((a, b) => a.nombreComercial.localeCompare(b.nombreComercial, "es"));

  return {
    periods,
    rows,
    summary: {
      totalBudgetUf,
      tenantsWithData,
      tenantsWithMissing,
    },
  };
}

export async function fetchBudgetedSalesMatrix(
  projectId: string,
  desde: string,
  hasta: string,
): Promise<BudgetedSalesMatrixResponse> {
  const periods = buildPeriodRange(desde, hasta);
  if (periods.length === 0) {
    return { periods: [], rows: [], summary: { totalBudgetUf: 0, tenantsWithData: 0, tenantsWithMissing: 0 } };
  }

  const rangeStart = periodToDate(desde);
  const rangeEndExclusive = periodToDate(shiftPeriod(hasta, 1));

  const [budgetedSales, tenants, contracts] = await Promise.all([
    prisma.tenantBudgetedSale.findMany({
      where: {
        projectId,
        period: { gte: rangeStart, lt: rangeEndExclusive },
      },
      select: { tenantId: true, period: true, salesUf: true },
    }),
    prisma.tenant.findMany({
      where: { proyectoId: projectId },
      select: { id: true, rut: true, nombreComercial: true },
    }),
    prisma.contract.findMany({
      where: {
        proyectoId: projectId,
        estado: ContractStatus.VIGENTE,
        fechaInicio: { lt: rangeEndExclusive },
        fechaTermino: { gte: rangeStart },
      },
      select: {
        arrendatarioId: true,
        localId: true,
        local: { select: { glam2: true } },
      },
    }),
  ]);

  const tenantsById = new Map<string, TenantInfo>();
  for (const t of tenants) {
    tenantsById.set(t.id, { id: t.id, rut: t.rut, nombreComercial: t.nombreComercial });
  }

  const glaByTenantId = new Map<string, number>();
  const seenLocalsByTenant = new Map<string, Set<string>>();
  for (const c of contracts) {
    const seen = seenLocalsByTenant.get(c.arrendatarioId) ?? new Set<string>();
    if (seen.has(c.localId)) continue;
    seen.add(c.localId);
    seenLocalsByTenant.set(c.arrendatarioId, seen);
    const current = glaByTenantId.get(c.arrendatarioId) ?? 0;
    glaByTenantId.set(c.arrendatarioId, current + toNum(c.local.glam2));
  }

  return buildBudgetedSalesMatrix({
    budgetedSales,
    tenantsById,
    glaByTenantId,
    periods,
  });
}
