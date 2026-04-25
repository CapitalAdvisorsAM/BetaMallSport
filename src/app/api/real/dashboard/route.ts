import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getFinanceMode, getFinancePeriod, getFinanceProjectId } from "@/lib/real/api-params";
import { BELOW_EBITDA_GROUPS } from "@/lib/real/eerr";
import { buildPanelKpi } from "@/lib/real/panel-kpis";
import { getRequiredActiveProjectIdSearchParam } from "@/lib/http/request";
import { buildMetricsCacheKey, getOrSetMetricsCache } from "@/lib/metrics-cache";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { PanelCdgKpi } from "@/types/panel-cdg";

type Mode = "month" | "year" | "ltm";

type AccountingRow = {
  group1: string;
  group3: string;
  period: Date;
  valueUf: { toString(): string };
};

type BudgetRow = {
  grupo1: string;
  grupo3: string;
  periodo: Date;
  valorUf: { toString(): string };
};

type SaleRow = {
  period: Date;
  salesPesos: { toString(): string };
};

type BalanceRow = {
  category: string;
  valueUf: { toString(): string };
};

const INCOME_GROUP = "INGRESOS DE EXPLOTACION";
const RECOVERY_GGCC_GROUP3 = "RECUPERACION GASTOS COMUNES";
const GGCC_COST_GROUP = "VACANCIA G.C. + CONTRIBUCIONES";

function monthStart(period: string): Date {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function getRange(mode: Mode, period: string): { fromDate: Date; toDate: Date } {
  if (mode === "month") {
    const month = monthStart(period);
    return { fromDate: month, toDate: month };
  }
  if (mode === "year") {
    const year = Number(period);
    return {
      fromDate: new Date(Date.UTC(year, 0, 1)),
      toDate: new Date(Date.UTC(year, 11, 1))
    };
  }
  const end = monthStart(period);
  return {
    fromDate: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1)),
    toDate: end
  };
}

function shiftYearBack(range: { fromDate: Date; toDate: Date }) {
  return {
    fromDate: new Date(Date.UTC(range.fromDate.getUTCFullYear() - 1, range.fromDate.getUTCMonth(), 1)),
    toDate: new Date(Date.UTC(range.toDate.getUTCFullYear() - 1, range.toDate.getUTCMonth(), 1))
  };
}

function ytdRange(period: string) {
  const [year, month] = period.split("-").map(Number);
  return {
    fromDate: new Date(Date.UTC(year, 0, 1)),
    toDate: new Date(Date.UTC(year, month - 1, 1))
  };
}

function periodKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function monthsBetween(fromDate: Date, toDate: Date): Date[] {
  const months: Date[] = [];
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    months.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function toNumber(raw: { toString(): string } | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  return Number(raw.toString());
}

function sumAccounting(records: AccountingRow[], options?: { group1?: string; group3?: string }): number {
  return records.reduce((sum, record) => {
    if (options?.group1 && record.group1 !== options.group1) return sum;
    if (options?.group3 && record.group3 !== options.group3) return sum;
    return sum + toNumber(record.valueUf);
  }, 0);
}

function sumBudget(records: BudgetRow[], options?: { group1?: string; group3?: string }): number {
  return records.reduce((sum, record) => {
    if (options?.group1 && record.grupo1 !== options.group1) return sum;
    if (options?.group3 && record.grupo3 !== options.group3) return sum;
    return sum + toNumber(record.valorUf);
  }, 0);
}

function sumEbitda(records: AccountingRow[]): number {
  return records.reduce((sum, record) => {
    if (BELOW_EBITDA_GROUPS.has(record.group1)) return sum;
    return sum + toNumber(record.valueUf);
  }, 0);
}

function sumEbitdaBudget(records: BudgetRow[]): number {
  return records.reduce((sum, record) => {
    if (BELOW_EBITDA_GROUPS.has(record.grupo1)) return sum;
    return sum + toNumber(record.valorUf);
  }, 0);
}

function sumSales(records: SaleRow[]): number {
  return records.reduce((sum, record) => sum + toNumber(record.salesPesos), 0);
}

function sumCashBalances(records: BalanceRow[]): number | null {
  if (records.length === 0) return null;
  return records.reduce((sum, record) => {
    if (!record.category.toLowerCase().includes("efectivo")) return sum;
    return sum + toNumber(record.valueUf);
  }, 0);
}

async function queryAccounting(projectId: string, from: Date, to: Date): Promise<AccountingRow[]> {
  return prisma.accountingRecord.findMany({
    where: { projectId, period: { gte: from, lte: to } },
    select: { group1: true, group3: true, period: true, valueUf: true }
  });
}

async function queryBudgets(projectId: string, from: Date, to: Date): Promise<BudgetRow[]> {
  return prisma.expenseBudget.findMany({
    where: { projectId, periodo: { gte: from, lte: to } },
    select: { grupo1: true, grupo3: true, periodo: true, valorUf: true }
  });
}

async function querySales(projectId: string, from: Date, to: Date): Promise<SaleRow[]> {
  return prisma.tenantSale.findMany({
    where: { projectId, period: { gte: from, lte: to } },
    select: { period: true, salesPesos: true }
  });
}

async function queryBudgetedSales(projectId: string, from: Date, to: Date): Promise<SaleRow[]> {
  return prisma.tenantBudgetedSale.findMany({
    where: { projectId, period: { gte: from, lte: to } },
    select: { period: true, salesPesos: true }
  });
}

async function queryCashBalances(projectId: string, from: Date, to: Date): Promise<BalanceRow[]> {
  return prisma.balanceRecord.findMany({
    where: {
      projectId,
      period: { gte: from, lte: to },
      category: { contains: "Efectivo", mode: "insensitive" }
    },
    select: { category: true, valueUf: true }
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const parsedProjectId = getFinanceProjectId(searchParams);
    const rawMode = getFinanceMode(searchParams) ?? "month";
    const mode: Mode =
      rawMode === "ltm"
        ? "ltm"
        : rawMode === "year" || rawMode === "anio"
          ? "year"
          : "month";
    const period = getFinancePeriod(searchParams);

    if (!parsedProjectId) throw new ApiError(400, "projectId requerido.");
    if (!period) throw new ApiError(400, "period requerido.");

    searchParams.set("projectId", parsedProjectId);
    const projectId = await getRequiredActiveProjectIdSearchParam(searchParams);
    const cacheKey = buildMetricsCacheKey("finance-dashboard", [projectId, mode, period]);
    const payload = await getOrSetMetricsCache(cacheKey, projectId, 120_000, async () => {
      const range = getRange(mode, period);
      const priorRange = shiftYearBack(range);

      const [currentRecords, priorRecords, currentBudgets] = await Promise.all([
        queryAccounting(projectId, range.fromDate, range.toDate),
        queryAccounting(projectId, priorRange.fromDate, priorRange.toDate),
        mode === "month"
          ? queryBudgets(projectId, range.fromDate, range.toDate)
          : Promise.resolve<BudgetRow[]>([])
      ]);

      const currentIncome = sumAccounting(currentRecords, { group1: INCOME_GROUP });
      const priorIncome = sumAccounting(priorRecords, { group1: INCOME_GROUP });
      const currentEbitda = sumEbitda(currentRecords);
      const priorEbitda = sumEbitda(priorRecords);

      let ytdIncome: { current: number; prior: number } | null = null;
      let ytdEbitda: { current: number; prior: number } | null = null;
      let panel: PanelCdgKpi[] = [];

      if (mode === "month") {
        const ytd = ytdRange(period);
        const priorYtd = shiftYearBack(ytd);
        const [
          ytdRecords,
          priorYtdRecords,
          ytdBudgets,
          currentSales,
          priorSales,
          ytdSales,
          priorYtdSales,
          currentBudgetedSales,
          ytdBudgetedSales,
          currentCashBalances,
          priorCashBalances
        ] = await Promise.all([
          queryAccounting(projectId, ytd.fromDate, ytd.toDate),
          queryAccounting(projectId, priorYtd.fromDate, priorYtd.toDate),
          queryBudgets(projectId, ytd.fromDate, ytd.toDate),
          querySales(projectId, range.fromDate, range.toDate),
          querySales(projectId, priorRange.fromDate, priorRange.toDate),
          querySales(projectId, ytd.fromDate, ytd.toDate),
          querySales(projectId, priorYtd.fromDate, priorYtd.toDate),
          queryBudgetedSales(projectId, range.fromDate, range.toDate),
          queryBudgetedSales(projectId, ytd.fromDate, ytd.toDate),
          queryCashBalances(projectId, range.fromDate, range.toDate),
          queryCashBalances(projectId, priorRange.fromDate, priorRange.toDate)
        ]);

        ytdIncome = {
          current: sumAccounting(ytdRecords, { group1: INCOME_GROUP }),
          prior: sumAccounting(priorYtdRecords, { group1: INCOME_GROUP })
        };
        ytdEbitda = {
          current: sumEbitda(ytdRecords),
          prior: sumEbitda(priorYtdRecords)
        };

        const monthBudgetIncomeUf = sumBudget(currentBudgets, { group1: INCOME_GROUP });
        const ytdBudgetIncomeUf = sumBudget(ytdBudgets, { group1: INCOME_GROUP });

        const currentSalesUf = sumSales(currentSales);
        const priorSalesUf = sumSales(priorSales);
        const ytdSalesUf = sumSales(ytdSales);
        const priorYtdSalesUf = sumSales(priorYtdSales);
        const currentBudgetSalesUf = sumSales(currentBudgetedSales);
        const ytdBudgetSalesUf = sumSales(ytdBudgetedSales);
        const currentCashUf = sumCashBalances(currentCashBalances);
        const priorCashUf = sumCashBalances(priorCashBalances);

        // Panel de Operación Real: solo KPIs derivables de data contable, SAP y ventas reales.
        // UF/m², Vacancia, GLA y Costo de Ocupación viven en Plan / Reconciliación (ver plan de 3 mundos).
        panel = [
        buildPanelKpi("total_ingresos_uf", "Total Ingresos", "uf", {
          mesReal: currentIncome,
          mesPpto: monthBudgetIncomeUf,
          mesPrior: priorIncome,
          ytdReal: ytdIncome.current,
          ytdPpto: ytdBudgetIncomeUf,
          ytdPrior: ytdIncome.prior
        }, "EE.RR. (UF)"),
        buildPanelKpi("recuperacion_ggcc_uf", "Recuperación Gastos Comunes", "uf", {
          mesReal: sumAccounting(currentRecords, { group3: RECOVERY_GGCC_GROUP3 }),
          mesPpto: sumBudget(currentBudgets, { group3: RECOVERY_GGCC_GROUP3 }),
          mesPrior: sumAccounting(priorRecords, { group3: RECOVERY_GGCC_GROUP3 }),
          ytdReal: sumAccounting(ytdRecords, { group3: RECOVERY_GGCC_GROUP3 }),
          ytdPpto: sumBudget(ytdBudgets, { group3: RECOVERY_GGCC_GROUP3 }),
          ytdPrior: sumAccounting(priorYtdRecords, { group3: RECOVERY_GGCC_GROUP3 })
        }, "EE.RR. (UF)"),
        buildPanelKpi("costo_ggcc_uf", "Costo Gasto Común", "uf", {
          mesReal: sumAccounting(currentRecords, { group1: GGCC_COST_GROUP }),
          mesPpto: sumBudget(currentBudgets, { group1: GGCC_COST_GROUP }),
          mesPrior: sumAccounting(priorRecords, { group1: GGCC_COST_GROUP }),
          ytdReal: sumAccounting(ytdRecords, { group1: GGCC_COST_GROUP }),
          ytdPpto: sumBudget(ytdBudgets, { group1: GGCC_COST_GROUP }),
          ytdPrior: sumAccounting(priorYtdRecords, { group1: GGCC_COST_GROUP })
        }, "EE.RR. (UF)"),
        buildPanelKpi("ebitda_uf", "EBITDA", "uf", {
          mesReal: currentEbitda,
          mesPpto: sumEbitdaBudget(currentBudgets),
          mesPrior: priorEbitda,
          ytdReal: ytdEbitda.current,
          ytdPpto: sumEbitdaBudget(ytdBudgets),
          ytdPrior: ytdEbitda.prior
        }, "EE.RR. (UF)"),
        buildPanelKpi("ventas_reales_uf", "Ventas Reales", "uf", {
          mesReal: currentSalesUf,
          mesPpto: currentBudgetSalesUf,
          mesPrior: priorSalesUf,
          ytdReal: ytdSalesUf,
          ytdPpto: ytdBudgetSalesUf,
          ytdPrior: priorYtdSalesUf
        }, "Ventas (UF)"),
        buildPanelKpi("caja_eop_uf", "Caja EoP", "uf", {
          mesReal: currentCashUf,
          mesPpto: null,
          mesPrior: priorCashUf,
          ytdReal: currentCashUf,
          ytdPpto: null,
          ytdPrior: priorCashUf
        }, "Flujo Caja (UF)")
        ];
      }

      const months = monthsBetween(range.fromDate, range.toDate).map(periodKey);
      const incomeByMonth = new Map<string, number>();
      const ebitdaByMonth = new Map<string, number>();
      const priorIncomeByMonth = new Map<string, number>();

      for (const record of currentRecords) {
        const month = periodKey(record.period);
        const value = toNumber(record.valueUf);
        if (record.group1 === INCOME_GROUP) {
          incomeByMonth.set(month, (incomeByMonth.get(month) ?? 0) + value);
        }
        if (!BELOW_EBITDA_GROUPS.has(record.group1)) {
          ebitdaByMonth.set(month, (ebitdaByMonth.get(month) ?? 0) + value);
        }
      }

      for (const record of priorRecords) {
        const month = `${record.period.getUTCFullYear() + 1}-${String(record.period.getUTCMonth() + 1).padStart(2, "0")}`;
        if (record.group1 === INCOME_GROUP) {
          priorIncomeByMonth.set(month, (priorIncomeByMonth.get(month) ?? 0) + toNumber(record.valueUf));
        }
      }

      const sectionsMap = new Map<string, { current: number; prior: number }>();
      for (const record of currentRecords) {
        const section = sectionsMap.get(record.group1) ?? { current: 0, prior: 0 };
        section.current += toNumber(record.valueUf);
        sectionsMap.set(record.group1, section);
      }
      for (const record of priorRecords) {
        const section = sectionsMap.get(record.group1) ?? { current: 0, prior: 0 };
        section.prior += toNumber(record.valueUf);
        sectionsMap.set(record.group1, section);
      }

      return {
        kpis: {
          income: { current: currentIncome, prior: priorIncome },
          ebitda: {
            current: currentEbitda,
            prior: priorEbitda,
            marginPct: currentIncome !== 0 ? (currentEbitda / currentIncome) * 100 : null
          },
          ytdIncome,
          ytdEbitda
        },
        panel,
        chart: {
          months,
          currentIncome: months.map((month) => incomeByMonth.get(month) ?? 0),
          priorIncome: months.map((month) => priorIncomeByMonth.get(month) ?? 0),
          currentEbitda: months.map((month) => ebitdaByMonth.get(month) ?? 0)
        },
        sectionsEerr: [...sectionsMap.entries()].map(([group1, values]) => ({ group1, ...values }))
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
