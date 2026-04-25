import { ContractRateType, ContractStatus } from "@prisma/client";
import {
  type DecimalLike,
  toNum,
  periodKey,
  isContractActiveInPeriod,
  shiftPeriod,
  calcTieredVariableRent,
  extractVariableRentTiers,
  calcExpectedIncome,
} from "@/lib/real/billing-utils";
import {
  calculateFixedRentUf,
  calculateEstimatedGgccUf,
  calculateWalt,
  type KpiContractInput,
  type KpiGgccInput,
  type KpiTarifaInput
} from "@/lib/kpi";
import { MS_PER_DAY, VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { startOfDay } from "@/lib/utils";
import type {
  Tenant360Data,
  Tenant360Profile,
  Tenant360QuickStats,
  Tenant360Kpis,
  Tenant360MonthlyPoint,
  Tenant360Contract,
  Tenant360Rate,
  Tenant360Ggcc,
  Tenant360Amendment,
  Tenant360SalesPoint,
  Tenant360Projection,
  ExpiringContract,
  GapAnalysisRow,
  BillingCategory,
  OccupancyDayEntry,
  PeerComparison
} from "@/types/tenant-360";

// ---------------------------------------------------------------------------
// Input types — shape of raw Prisma data passed in from the API route
// ---------------------------------------------------------------------------

function dateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export type RawTenant = {
  id: string;
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  vigente: boolean;
  email: string | null;
  telefono: string | null;
};

export type RawContractRate = {
  tipo: ContractRateType;
  valor: DecimalLike;
  umbralVentasUf?: DecimalLike | null;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
  esDiciembre: boolean;
  // Legacy 4-field discount projection populated at the route boundary from
  // ContractRateDiscount via legacyDiscountFields(). Optional because some
  // upstream routes still pass tarifas without the projection (those callers
  // silently lose discount info — see follow-up items).
  descuentoTipo?: import("@prisma/client").ContractDiscountType | null;
  descuentoValor?: DecimalLike | null;
  descuentoDesde?: Date | null;
  descuentoHasta?: Date | null;
};

export type RawContractGgcc = {
  tarifaBaseUfM2: DecimalLike;
  pctAdministracion: DecimalLike;
  pctReajuste: DecimalLike | null;
  proximoReajuste: Date | null;
  mesesReajuste: number | null;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
};

export type RawContractAmendment = {
  id: string;
  fecha: Date;
  descripcion: string;
  camposModificados: unknown;
};

export type RawContract = {
  id: string;
  numeroContrato: string;
  localId: string;
  local: {
    id: string;
    codigo: string;
    nombre: string;
    glam2: DecimalLike;
    esGLA: boolean;
  };
  estado: ContractStatus;
  fechaInicio: Date;
  fechaTermino: Date;
  fechaEntrega: Date | null;
  fechaApertura: Date | null;
  diasGracia: number;
  multiplicadorDiciembre: DecimalLike | null;
  multiplicadorJunio: DecimalLike | null;
  multiplicadorJulio: DecimalLike | null;
  multiplicadorAgosto: DecimalLike | null;
  pctFondoPromocion: DecimalLike | null;
  codigoCC: string | null;
  pdfUrl: string | null;
  notas: string | null;
  tarifas: RawContractRate[];
  ggcc: RawContractGgcc[];
  anexos: RawContractAmendment[];
};

export type RawAccountingRecord = {
  unitId: string | null;
  period: Date;
  group1: string;
  group3: string;
  denomination: string;
  valueUf: DecimalLike;
};

export type RawUnitSale = {
  tenantId: string;
  period: Date;
  salesPesos: DecimalLike;
};

export type RawContractDay = {
  localId: string;
  local?: { codigo: string } | null;
  fecha: Date;
  estadoDia: "OCUPADO" | "GRACIA" | "VACANTE";
  glam2: DecimalLike;
};

export type RawUfValue = {
  fecha: Date;
  valor: DecimalLike;
};

export type BuildTenant360Input = {
  tenant: RawTenant;
  contracts: RawContract[];
  accountingRecords: RawAccountingRecord[];
  sales: RawUnitSale[];
  contractDays: RawContractDay[];
  latestUf: RawUfValue | null;
  periods: string[];
  peerComparison?: PeerComparison | null;
  ufRateByPeriod?: Map<string, number>;
};

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export function buildTenant360Data(input: BuildTenant360Input): Tenant360Data {
  const { tenant, contracts, accountingRecords, sales, contractDays, latestUf, periods, peerComparison, ufRateByPeriod = new Map() } = input;

  const activeContracts = contracts.filter(
    (c) => c.estado === ContractStatus.VIGENTE || c.estado === ContractStatus.GRACIA
  );

  const profile = buildProfile(tenant);
  const kpiContracts = toKpiContracts(activeContracts);
  const quickStats = buildQuickStats(activeContracts, kpiContracts, latestUf);
  const monthlyTimeline = buildMonthlyTimeline(accountingRecords, sales, periods, quickStats.totalLeasedM2);
  const kpis = buildKpis(kpiContracts, monthlyTimeline, latestUf, quickStats.totalLeasedM2);
  const serializedContracts = serializeContracts(contracts);
  const billingBreakdown = buildBillingBreakdown(accountingRecords);
  const salesPerformance = buildSalesPerformance(sales, activeContracts, periods, quickStats.totalLeasedM2, quickStats.ufValue);
  const occupancyDays = serializeOccupancyDays(contractDays);
  const projections = buildProjections(activeContracts);
  const gapAnalysis = buildGapAnalysis(activeContracts, accountingRecords, sales, periods, contractDays, ufRateByPeriod);

  return {
    profile,
    quickStats,
    kpis,
    monthlyTimeline,
    contracts: serializedContracts,
    billingBreakdown,
    salesPerformance,
    occupancyDays,
    projections,
    gapAnalysis,
    peerComparison: peerComparison ?? null
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function buildProfile(tenant: RawTenant): Tenant360Profile {
  return {
    id: tenant.id,
    rut: tenant.rut,
    razonSocial: tenant.razonSocial,
    nombreComercial: tenant.nombreComercial,
    vigente: tenant.vigente,
    email: tenant.email,
    telefono: tenant.telefono
  };
}

// ---------------------------------------------------------------------------
// KPI contract shape adapter
// ---------------------------------------------------------------------------

function findCurrentRate(tarifas: RawContractRate[]): RawContractRate | null {
  const now = new Date();
  const sorted = [...tarifas]
    .filter((t) => !t.esDiciembre)
    .sort((a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime());

  for (const t of sorted) {
    if (t.vigenciaDesde <= now && (!t.vigenciaHasta || t.vigenciaHasta >= now)) {
      return t;
    }
  }
  return sorted[0] ?? null;
}

function findCurrentGgcc(ggccList: RawContractGgcc[]): RawContractGgcc | null {
  const now = new Date();
  const sorted = [...ggccList].sort((a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime());

  for (const g of sorted) {
    if (g.vigenciaDesde <= now && (!g.vigenciaHasta || g.vigenciaHasta >= now)) {
      return g;
    }
  }
  return sorted[0] ?? null;
}

function toKpiContracts(contracts: RawContract[]): KpiContractInput[] {
  return contracts.map((c) => {
    const rate = findCurrentRate(c.tarifas);
    const ggcc = findCurrentGgcc(c.ggcc);
    const variableRate = c.tarifas.find((t) => t.tipo === ContractRateType.PORCENTAJE);

    return {
      id: c.id,
      localId: c.localId,
      localCodigo: c.local.codigo,
      localEsGLA: c.local.esGLA,
      localGlam2: c.local.glam2,
      arrendatarioNombre: "",
      numeroContrato: c.numeroContrato,
      fechaTermino: c.fechaTermino,
      tarifaVariablePct: variableRate ? variableRate.valor : null,
      tarifa: rate ? { tipo: rate.tipo, valor: rate.valor } as KpiTarifaInput : null,
      ggcc: ggcc ? { tarifaBaseUfM2: ggcc.tarifaBaseUfM2, pctAdministracion: ggcc.pctAdministracion } as KpiGgccInput : null
    };
  });
}

// ---------------------------------------------------------------------------
// Quick Stats
// ---------------------------------------------------------------------------

function buildQuickStats(
  activeContracts: RawContract[],
  kpiContracts: KpiContractInput[],
  latestUf: RawUfValue | null
): Tenant360QuickStats {
  const totalLeasedM2 = activeContracts.reduce(
    (sum, c) => sum + (c.local.esGLA ? toNum(c.local.glam2) : 0),
    0
  );
  const monthlyFixedRentUf = calculateFixedRentUf(kpiContracts);
  const ufValue = latestUf ? toNum(latestUf.valor) : 0;

  return {
    totalLeasedM2,
    activeContractCount: activeContracts.length,
    monthlyFixedRentUf,
    monthlyFixedRentClp: monthlyFixedRentUf * ufValue,
    ufValue,
    ufDate: latestUf ? dateStr(latestUf.fecha) ?? "" : ""
  };
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function buildKpis(
  kpiContracts: KpiContractInput[],
  timeline: Tenant360MonthlyPoint[],
  latestUf: RawUfValue | null,
  totalLeasedM2: number
): Tenant360Kpis {
  const rentaFijaMensualUf = calculateFixedRentUf(kpiContracts);
  const ufValue = latestUf ? toNum(latestUf.valor) : 0;
  const ggccEstimadoUf = calculateEstimatedGgccUf(kpiContracts);
  const waltMeses = calculateWalt(kpiContracts, new Date());

  const totalBilling = timeline.reduce((s, p) => s + p.billingUf, 0);
  const totalSales = timeline.reduce((s, p) => s + p.salesPesos, 0);
  const periodsWithSales = timeline.filter((p) => p.salesPesos > 0).length;
  const periodsWithBilling = timeline.filter((p) => p.billingUf > 0).length;

  const avgMonthlyBilling = periodsWithBilling > 0 ? totalBilling / periodsWithBilling : 0;
  const avgMonthlySales = periodsWithSales > 0 ? totalSales / periodsWithSales : 0;

  return {
    costoOcupacionPct: totalSales > 0 ? (totalBilling / totalSales) * 100 : null,
    rentaFijaMensualUf,
    rentaFijaClp: rentaFijaMensualUf * ufValue,
    ggccEstimadoUf,
    ventasPromedioMensualPesos: avgMonthlySales,
    waltMeses,
    facturacionUfM2: totalLeasedM2 > 0 ? avgMonthlyBilling / totalLeasedM2 : null,
    ventasPesosM2: totalLeasedM2 > 0 ? avgMonthlySales / totalLeasedM2 : null
  };
}

// ---------------------------------------------------------------------------
// Monthly Timeline
// ---------------------------------------------------------------------------

export function buildMonthlyTimeline(
  records: RawAccountingRecord[],
  sales: RawUnitSale[],
  periods: string[],
  totalLeasedM2: number
): Tenant360MonthlyPoint[] {
  const billingByPeriod = new Map<string, number>();
  const salesByPeriod = new Map<string, number>();

  for (const r of records) {
    const p = periodKey(r.period);
    billingByPeriod.set(p, (billingByPeriod.get(p) ?? 0) + toNum(r.valueUf));
  }

  for (const s of sales) {
    const p = periodKey(s.period);
    salesByPeriod.set(p, (salesByPeriod.get(p) ?? 0) + toNum(s.salesPesos));
  }

  return periods.map((period) => {
    const billingUf = billingByPeriod.get(period) ?? 0;
    const salesPesos = salesByPeriod.get(period) ?? 0;
    return {
      period,
      billingUf,
      salesPesos,
      costoOcupacionPct: salesPesos > 0 ? (billingUf / salesPesos) * 100 : null,
      billingUfM2: totalLeasedM2 > 0 ? billingUf / totalLeasedM2 : null
    };
  });
}

// ---------------------------------------------------------------------------
// Contract serialization
// ---------------------------------------------------------------------------

function serializeRate(r: RawContractRate): Tenant360Rate {
  return {
    tipo: r.tipo,
    valor: toNum(r.valor),
    umbralVentasUf: r.umbralVentasUf !== undefined && r.umbralVentasUf !== null ? toNum(r.umbralVentasUf) : null,
    vigenciaDesde: dateStr(r.vigenciaDesde)!,
    vigenciaHasta: dateStr(r.vigenciaHasta),
    esDiciembre: r.esDiciembre
  };
}

function serializeGgcc(g: RawContractGgcc): Tenant360Ggcc {
  return {
    tarifaBaseUfM2: toNum(g.tarifaBaseUfM2),
    pctAdministracion: toNum(g.pctAdministracion),
    pctReajuste: g.pctReajuste !== null ? toNum(g.pctReajuste) : null,
    proximoReajuste: dateStr(g.proximoReajuste),
    mesesReajuste: g.mesesReajuste,
    vigenciaDesde: dateStr(g.vigenciaDesde)!,
    vigenciaHasta: dateStr(g.vigenciaHasta)
  };
}

function serializeAmendment(a: RawContractAmendment): Tenant360Amendment {
  const campos = Array.isArray(a.camposModificados)
    ? (a.camposModificados as string[])
    : [];
  return {
    id: a.id,
    fecha: dateStr(a.fecha)!,
    descripcion: a.descripcion,
    camposModificados: campos
  };
}

function serializeContracts(contracts: RawContract[]): Tenant360Contract[] {
  const today = startOfDay(new Date());

  return contracts.map((c) => {
    const currentRate = findCurrentRate(c.tarifas);
    const currentGgcc = findCurrentGgcc(c.ggcc);
    const diasRestantes = Math.max(
      0,
      Math.round((startOfDay(c.fechaTermino).getTime() - today.getTime()) / MS_PER_DAY)
    );

    return {
      id: c.id,
      numeroContrato: c.numeroContrato,
      localCodigo: c.local.codigo,
      localNombre: c.local.nombre,
      localGlam2: toNum(c.local.glam2),
      estado: c.estado,
      fechaInicio: dateStr(c.fechaInicio)!,
      fechaTermino: dateStr(c.fechaTermino)!,
      fechaEntrega: dateStr(c.fechaEntrega),
      fechaApertura: dateStr(c.fechaApertura),
      diasGracia: c.diasGracia,
      diasRestantes,
      multiplicadorDiciembre: c.multiplicadorDiciembre !== null ? toNum(c.multiplicadorDiciembre) : null,
      multiplicadorJunio: c.multiplicadorJunio !== null ? toNum(c.multiplicadorJunio) : null,
      multiplicadorJulio: c.multiplicadorJulio !== null ? toNum(c.multiplicadorJulio) : null,
      multiplicadorAgosto: c.multiplicadorAgosto !== null ? toNum(c.multiplicadorAgosto) : null,
      pctFondoPromocion: c.pctFondoPromocion !== null ? toNum(c.pctFondoPromocion) : null,
      codigoCC: c.codigoCC,
      pdfUrl: c.pdfUrl,
      notas: c.notas,
      tarifaActual: currentRate ? serializeRate(currentRate) : null,
      historialTarifas: c.tarifas.map(serializeRate),
      ggccActual: currentGgcc ? serializeGgcc(currentGgcc) : null,
      anexos: c.anexos.map(serializeAmendment)
    };
  });
}

// ---------------------------------------------------------------------------
// Billing Breakdown
// ---------------------------------------------------------------------------

export function buildBillingBreakdown(records: RawAccountingRecord[]): BillingCategory[] {
  const map = new Map<string, BillingCategory>();

  for (const r of records) {
    const key = `${r.group1}||${r.group3}`;
    const p = periodKey(r.period);
    const value = toNum(r.valueUf);

    if (!map.has(key)) {
      map.set(key, { group1: r.group1, group3: r.group3, byPeriod: {}, total: 0 });
    }

    const entry = map.get(key)!;
    entry.byPeriod[p] = (entry.byPeriod[p] ?? 0) + value;
    entry.total += value;
  }

  return [...map.values()].sort((a, b) => a.group1.localeCompare(b.group1) || a.group3.localeCompare(b.group3));
}

// ---------------------------------------------------------------------------
// Sales Performance
// ---------------------------------------------------------------------------

export function buildSalesPerformance(
  sales: RawUnitSale[],
  activeContracts: RawContract[],
  periods: string[],
  totalLeasedM2: number,
  ufValue: number
): Tenant360SalesPoint[] {
  const salesByPeriod = new Map<string, number>();
  for (const s of sales) {
    const p = periodKey(s.period);
    salesByPeriod.set(p, (salesByPeriod.get(p) ?? 0) + toNum(s.salesPesos));
  }

  // Build map of variable rent tiers and fixed rent by contract
  const variableRateByContract = new Map<string, { tiers: Array<{ umbralVentasUf: number; pct: number }>; fixedRentUf: number }>();
  for (const c of activeContracts) {
    const tiers = extractVariableRentTiers(c.tarifas);
    if (tiers.length > 0) {
      const glam2 = toNum(c.local.glam2);
      const fixedRate = c.tarifas.find(
        (t) => t.tipo === ContractRateType.FIJO_UF_M2 || t.tipo === ContractRateType.FIJO_UF
      );
      const fixedRentUf = fixedRate
        ? fixedRate.tipo === ContractRateType.FIJO_UF_M2
          ? toNum(fixedRate.valor) * glam2
          : toNum(fixedRate.valor)
        : 0;
      variableRateByContract.set(c.id, { tiers, fixedRentUf });
    }
  }

  // Build sales by tenant by period for variable rent calculation
  const salesByTenantPeriod = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const p = periodKey(s.period);
    const tenantMap = salesByTenantPeriod.get(s.tenantId) ?? new Map<string, number>();
    tenantMap.set(p, (tenantMap.get(p) ?? 0) + toNum(s.salesPesos));
    salesByTenantPeriod.set(s.tenantId, tenantMap);
  }

  // For a single-tenant view, get the first (only) tenant's sales map
  const tenantSalesMap = salesByTenantPeriod.values().next().value ?? new Map<string, number>();

  return periods.map((period) => {
    const salesPesos = salesByPeriod.get(period) ?? 0;
    const lagPeriod = shiftPeriod(period, -VARIABLE_RENT_LAG_MONTHS);

    let variableRentUf = 0;
    for (const [, { tiers, fixedRentUf }] of variableRateByContract) {
      const tenantSales = tenantSalesMap.get(lagPeriod) ?? 0;
      variableRentUf += calcTieredVariableRent(tenantSales, tiers, fixedRentUf);
    }

    return {
      period,
      salesPesos,
      salesPerM2: totalLeasedM2 > 0 ? salesPesos / totalLeasedM2 : 0,
      variableRentUf,
      salesClp: ufValue > 0 ? salesPesos * ufValue : null
    };
  });
}

// ---------------------------------------------------------------------------
// Occupancy Days
// ---------------------------------------------------------------------------

function serializeOccupancyDays(days: RawContractDay[]): OccupancyDayEntry[] {
  return days.map((d) => ({
    localCodigo: d.local?.codigo ?? "",
    fecha: dateStr(d.fecha)!,
    estadoDia: d.estadoDia,
    glam2: toNum(d.glam2)
  }));
}

// ---------------------------------------------------------------------------
// Projections
// ---------------------------------------------------------------------------

function buildProjections(activeContracts: RawContract[]): Tenant360Projection {
  const today = startOfDay(new Date());
  const expiringContracts: ExpiringContract[] = [];
  let totalRentAtRiskUf = 0;

  for (const c of activeContracts) {
    const endDate = startOfDay(c.fechaTermino);
    const diasRestantes = Math.max(
      0,
      Math.round((endDate.getTime() - today.getTime()) / MS_PER_DAY)
    );

    // Only include contracts expiring within 180 days
    if (diasRestantes > 180) continue;

    const rate = findCurrentRate(c.tarifas);
    let rentaFijaUf = 0;
    if (rate) {
      if (rate.tipo === ContractRateType.FIJO_UF_M2) {
        rentaFijaUf = toNum(rate.valor) * toNum(c.local.glam2);
      } else if (rate.tipo === ContractRateType.FIJO_UF) {
        rentaFijaUf = toNum(rate.valor);
      }
    }

    totalRentAtRiskUf += rentaFijaUf;

    let riskLevel: "low" | "medium" | "high" = "low";
    if (diasRestantes <= 30) riskLevel = "high";
    else if (diasRestantes <= 90) riskLevel = "medium";

    expiringContracts.push({
      id: c.id,
      localCodigo: c.local.codigo,
      fechaTermino: dateStr(c.fechaTermino)!,
      diasRestantes,
      rentaFijaUf,
      riskLevel
    });
  }

  expiringContracts.sort((a, b) => a.diasRestantes - b.diasRestantes);

  return { expiringContracts, totalRentAtRiskUf };
}

// ---------------------------------------------------------------------------
// Gap Analysis
// ---------------------------------------------------------------------------

export function buildGapAnalysis(
  activeContracts: RawContract[],
  accountingRecords: RawAccountingRecord[],
  sales: RawUnitSale[],
  periods: string[],
  contractDays?: RawContractDay[],
  ufRateByPeriod: Map<string, number> = new Map()
): GapAnalysisRow[] {
  // Build actual billing by period (from accounting)
  const actualByPeriod = new Map<string, number>();
  for (const r of accountingRecords) {
    if (r.group1 !== "INGRESOS DE EXPLOTACION") continue;
    const p = periodKey(r.period);
    actualByPeriod.set(p, (actualByPeriod.get(p) ?? 0) + toNum(r.valueUf));
  }

  // Build sales by tenant by period
  const salesByTenantPeriod = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const p = periodKey(s.period);
    const tenantMap = salesByTenantPeriod.get(s.tenantId) ?? new Map<string, number>();
    tenantMap.set(p, (tenantMap.get(p) ?? 0) + toNum(s.salesPesos));
    salesByTenantPeriod.set(s.tenantId, tenantMap);
  }

  // For a single-tenant view, get the first (only) tenant's sales map
  const tenantSalesMap = salesByTenantPeriod.values().next().value ?? new Map<string, number>();

  return periods.map((period) => {
    const periodDate = new Date(`${period}-01`);
    let expectedBillingUf = 0;

    for (const c of activeContracts) {
      if (!isContractActiveInPeriod(c, periodDate)) continue;

      const lagPeriod = shiftPeriod(period, -VARIABLE_RENT_LAG_MONTHS);
      const salesPesosRaw = tenantSalesMap.get(lagPeriod) ?? 0;
      const lagUfRate = ufRateByPeriod.get(lagPeriod) ?? 0;
      const salesUf = lagUfRate > 0 ? salesPesosRaw / lagUfRate : 0;

      const expected = calcExpectedIncome({
        tarifas: c.tarifas,
        ggcc: c.ggcc,
        glam2: toNum(c.local.glam2),
        multiplicadorDiciembre: c.multiplicadorDiciembre !== null ? toNum(c.multiplicadorDiciembre) : null,
        multiplicadorJunio: c.multiplicadorJunio !== null ? toNum(c.multiplicadorJunio) : null,
        multiplicadorJulio: c.multiplicadorJulio !== null ? toNum(c.multiplicadorJulio) : null,
        multiplicadorAgosto: c.multiplicadorAgosto !== null ? toNum(c.multiplicadorAgosto) : null,
        pctFondoPromocion: c.pctFondoPromocion !== null ? toNum(c.pctFondoPromocion) : null,
        periodDate,
        salesUf,
        estado: c.estado,
      });

      expectedBillingUf += expected.totalUf;
    }

    const actualBillingUf = actualByPeriod.get(period) ?? 0;
    const gapUf = expectedBillingUf - actualBillingUf;
    const gapPct = expectedBillingUf > 0 ? (gapUf / expectedBillingUf) * 100 : 0;

    // Pro-rata using ContratoDia if available
    let occupiedDays: number | null = null;
    let totalDays: number | null = null;
    let expectedProRataUf: number | null = null;
    let gapProRataUf: number | null = null;
    let gapProRataPct: number | null = null;

    if (contractDays && contractDays.length > 0) {
      const year = periodDate.getUTCFullYear();
      const month = periodDate.getUTCMonth();
      totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

      // Count occupied days across all units for this tenant in this period
      let occupied = 0;
      for (const day of contractDays) {
        const d = day.fecha;
        if (d.getUTCFullYear() === year && d.getUTCMonth() === month) {
          if (day.estadoDia === "OCUPADO" || day.estadoDia === "GRACIA") {
            occupied++;
          }
        }
      }
      occupiedDays = occupied;

      if (totalDays > 0 && expectedBillingUf > 0) {
        expectedProRataUf = expectedBillingUf * (occupiedDays / totalDays);
        gapProRataUf = expectedProRataUf - actualBillingUf;
        gapProRataPct = expectedProRataUf > 0 ? (gapProRataUf / expectedProRataUf) * 100 : 0;
      }
    }

    return {
      period,
      expectedBillingUf,
      actualBillingUf,
      gapUf,
      gapPct,
      occupiedDays,
      totalDays,
      expectedProRataUf,
      gapProRataUf,
      gapProRataPct
    };
  });
}
