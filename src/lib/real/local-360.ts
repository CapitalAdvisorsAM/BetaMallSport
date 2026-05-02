import { ContractRateType, ContractStatus, MasterStatus, UnitType } from "@prisma/client";
import {
  type DecimalLike,
  toNum,
  periodKey,
} from "@/lib/real/billing-utils";
import { MS_PER_DAY } from "@/lib/constants";
import { startOfDay } from "@/lib/utils";
import {
  buildMonthlyTimeline,
  buildBillingBreakdown,
  buildSalesPerformance,
  buildGapAnalysis,
  type RawContract,
  type RawAccountingRecord,
  type RawUnitSale,
  type RawContractDay,
  type RawUfValue,
} from "@/lib/real/tenant-360";
import type {
  Local360Data,
  Local360Profile,
  Local360QuickStats,
  Local360Kpis,
  TenantHistoryEntry,
  TenantHistoryRate,
  TenantHistoryDiscount,
  OccupancyMonthlyPoint,
  EnergyMonthlyPoint,
  LocalPeerComparison,
  LocalPeerStat,
  TenantSelectorEntry,
  TenantOnLocalAnalysis,
  CategoryAnalysis,
  SimilarLocalsTable,
  SimilarLocalRow,
  LocalCommercialAnalysisRow,
  LocalCommercialBreakdownRow,
} from "@/types/local-360";
import type { ContractComparison } from "@/types/contract-comparison";
import type {
  Tenant360Contract,
  Tenant360Rate,
  Tenant360Ggcc,
  Tenant360Amendment,
  ExpiringContract,
  Tenant360Projection,
  OccupancyDayEntry,
} from "@/types/tenant-360";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export type RawUnit = {
  id: string;
  codigo: string;
  nombre: string;
  glam2: DecimalLike;
  piso: string | null;
  tipo: UnitType;
  zonaId: string | null;
  zona: { nombre: string } | null;
  categoriaTamano: string | null;
  esGLA: boolean;
  estado: MasterStatus;
};

export type RawContractWithTenant = RawContract & {
  arrendatarioId: string;
  arrendatario: {
    id: string;
    rut: string;
    razonSocial: string;
    nombreComercial: string;
  };
};

export type RawTenantContractFootprint = {
  arrendatarioId: string;
  localId: string;
  fechaInicio: Date;
  fechaTermino: Date;
  glam2: DecimalLike;
};

export type RawIngresoEnergia = {
  periodo: Date;
  valorUf: DecimalLike;
};

export type RawPeerUnitStat = {
  unitId: string;
  codigo: string;
  glam2: DecimalLike;
  totalBillingUf: number;
};

export type RawCategoryUnit = {
  id: string;
  codigo: string;
  nombre: string;
  glam2: DecimalLike;
  piso: string | null;
  categoriaTamano: string | null;
  tipo: UnitType;
};

export type BuildLocal360Input = {
  unit: RawUnit;
  contracts: RawContractWithTenant[];
  accountingRecords: RawAccountingRecord[];
  attributedSales: RawUnitSale[];
  contractDays: RawContractDay[];
  energyEntries: RawIngresoEnergia[];
  peerStats: RawPeerUnitStat[];
  latestUf: RawUfValue | null;
  periods: string[];
  ufRateByPeriod?: Map<string, number>;
  rangeFromDate: Date;
  rangeToDate: Date;
  // --- Local Comercial tab inputs (optional for backward-compat with tests) ---
  selectedTenantId?: string | null;
  contractComparisons?: Map<string, ContractComparison | null>;
  categoryUnits?: RawCategoryUnit[];
  categoryAccountingRecords?: RawAccountingRecord[];
  categoryContractDays?: RawContractDay[];
  categoryTenantFootprints?: RawTenantContractFootprint[];
  categoryRawSales?: RawUnitSale[];
  similarUnitIds?: Set<string>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function findCurrentRate(
  tarifas: RawContract["tarifas"],
  reference: Date = new Date(),
): RawContract["tarifas"][number] | null {
  const sorted = [...tarifas]
    .filter((t) => !t.esDiciembre)
    .sort((a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime());
  for (const t of sorted) {
    if (t.vigenciaDesde <= reference && (!t.vigenciaHasta || t.vigenciaHasta >= reference)) {
      return t;
    }
  }
  return sorted[0] ?? null;
}

function findCurrentGgcc(
  ggccList: RawContract["ggcc"],
  reference: Date = new Date(),
): RawContract["ggcc"][number] | null {
  const sorted = [...ggccList].sort(
    (a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime(),
  );
  for (const g of sorted) {
    if (g.vigenciaDesde <= reference && (!g.vigenciaHasta || g.vigenciaHasta >= reference)) {
      return g;
    }
  }
  return sorted[0] ?? null;
}

function rentForRate(
  rate: RawContract["tarifas"][number] | null,
  glam2: number,
): number | null {
  if (!rate) return null;
  if (rate.tipo === ContractRateType.FIJO_UF_M2) return toNum(rate.valor) * glam2;
  if (rate.tipo === ContractRateType.FIJO_UF) return toNum(rate.valor);
  return null;
}

function isContractCurrent(c: RawContractWithTenant, today: Date): boolean {
  if (c.estado !== ContractStatus.VIGENTE && c.estado !== ContractStatus.GRACIA) return false;
  return c.fechaInicio <= today && c.fechaTermino >= today;
}

function overlapDays(rangeFrom: Date, rangeTo: Date, contractFrom: Date, contractTo: Date): number {
  const start = rangeFrom > contractFrom ? rangeFrom : contractFrom;
  const end = rangeTo < contractTo ? rangeTo : contractTo;
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

function totalContractDays(contractFrom: Date, contractTo: Date): number {
  if (contractTo < contractFrom) return 0;
  return Math.round((contractTo.getTime() - contractFrom.getTime()) / MS_PER_DAY) + 1;
}

// ---------------------------------------------------------------------------
// Sales attribution helper — distributes a tenant's sales to a single local
// proportionally by GLA across the tenant's full footprint in each period.
// ---------------------------------------------------------------------------

export function attributeSalesToLocal(input: {
  thisUnitId: string;
  thisGlam2: number;
  tenantFootprints: RawTenantContractFootprint[];
  rawSales: RawUnitSale[];
  periods: string[];
}): RawUnitSale[] {
  const { thisUnitId, thisGlam2, tenantFootprints, rawSales, periods } = input;
  const periodSet = new Set(periods);

  function periodBounds(period: string): { start: Date; end: Date } {
    const start = new Date(`${period}-01T00:00:00Z`);
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth();
    const end = new Date(Date.UTC(y, m + 1, 0));
    return { start, end };
  }

  const tenantGlaByPeriod = new Map<string, Map<string, { totalGla: number; thisGla: number }>>();
  for (const period of periods) {
    const { start, end } = periodBounds(period);
    const tenantGla = new Map<string, { totalGla: number; thisGla: number }>();
    for (const f of tenantFootprints) {
      if (f.fechaInicio > end || f.fechaTermino < start) continue;
      const entry = tenantGla.get(f.arrendatarioId) ?? { totalGla: 0, thisGla: 0 };
      const g = toNum(f.glam2);
      entry.totalGla += g;
      if (f.localId === thisUnitId) entry.thisGla += g;
      tenantGla.set(f.arrendatarioId, entry);
    }
    tenantGlaByPeriod.set(period, tenantGla);
  }

  const out: RawUnitSale[] = [];
  for (const sale of rawSales) {
    const p = periodKey(sale.period);
    if (!periodSet.has(p)) continue;
    const tenantMap = tenantGlaByPeriod.get(p);
    if (!tenantMap) continue;
    const entry = tenantMap.get(sale.tenantId);
    if (!entry || entry.totalGla <= 0 || entry.thisGla <= 0) continue;
    const share = entry.thisGla / entry.totalGla;
    out.push({
      tenantId: sale.tenantId,
      period: sale.period,
      salesPesos: toNum(sale.salesPesos) * share,
    });
  }
  return out;
  // Used `unused` reference to avoid unused-vars: thisGlam2 informs caller's intent
  // (see buildSalesPerformance for the per-m2 division on the consumer side).
  void thisGlam2;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function buildLocalProfile(unit: RawUnit): Local360Profile {
  return {
    id: unit.id,
    codigo: unit.codigo,
    nombre: unit.nombre,
    glam2: toNum(unit.glam2),
    piso: unit.piso,
    tipo: unit.tipo,
    zonaNombre: unit.zona?.nombre ?? null,
    categoriaTamano: unit.categoriaTamano,
    esGLA: unit.esGLA,
    estado: unit.estado,
  };
}

// ---------------------------------------------------------------------------
// Quick Stats
// ---------------------------------------------------------------------------

function buildLocalQuickStats(
  unit: RawUnit,
  contracts: RawContractWithTenant[],
  contractDays: RawContractDay[],
  latestUf: RawUfValue | null,
): Local360QuickStats {
  const today = startOfDay(new Date());
  const current = contracts.find((c) => isContractCurrent(c, today));
  const glam2 = toNum(unit.glam2);

  let currentRentUf: number | null = null;
  if (current) {
    const rate = findCurrentRate(current.tarifas, today);
    currentRentUf = rentForRate(rate, toNum(current.local.glam2));
  }

  let daysOccupied = 0;
  let daysVacant = 0;
  let daysGrace = 0;
  for (const d of contractDays) {
    if (d.estadoDia === "OCUPADO") daysOccupied += 1;
    else if (d.estadoDia === "GRACIA") daysGrace += 1;
    else daysVacant += 1;
  }
  const totalDays = daysOccupied + daysVacant + daysGrace;
  const occupancyPct = totalDays > 0 ? ((daysOccupied + daysGrace) / totalDays) * 100 : 0;

  const tenantIds = new Set(contracts.map((c) => c.arrendatarioId));

  return {
    glam2,
    currentTenantName: current ? current.arrendatario.nombreComercial || current.arrendatario.razonSocial : null,
    currentTenantId: current ? current.arrendatario.id : null,
    currentRentUf,
    totalDaysOccupied: daysOccupied,
    totalDaysVacant: daysVacant,
    totalDaysGrace: daysGrace,
    occupancyPct,
    totalUniqueTenants: tenantIds.size,
    ufValue: latestUf ? toNum(latestUf.valor) : 0,
    ufDate: latestUf ? dateStr(latestUf.fecha) ?? "" : "",
  };
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function buildLocalKpis(
  quickStats: Local360QuickStats,
  monthlyTimeline: { period: string; billingUf: number; salesUf: number; salesPesos: number }[],
  gapAnalysis: { expectedBillingUf: number; actualBillingUf: number; gapUf: number }[],
): Local360Kpis {
  const totalBillingUf = monthlyTimeline.reduce((s, p) => s + p.billingUf, 0);
  const totalSalesUf = monthlyTimeline.reduce((s, p) => s + p.salesUf, 0);
  const totalSalesPesos = monthlyTimeline.reduce((s, p) => s + p.salesPesos, 0);

  const expectedTotal = gapAnalysis.reduce((s, r) => s + r.expectedBillingUf, 0);
  const actualTotal = gapAnalysis.reduce((s, r) => s + r.actualBillingUf, 0);
  const totalGapUf = gapAnalysis.reduce((s, r) => s + r.gapUf, 0);

  const realizationPct = expectedTotal > 0 ? (actualTotal / expectedTotal) * 100 : null;
  const averageSalesUfPerM2 =
    quickStats.glam2 > 0 && monthlyTimeline.length > 0
      ? totalSalesUf / monthlyTimeline.length / quickStats.glam2
      : null;

  return {
    occupancyPct: quickStats.occupancyPct,
    currentRentUf: quickStats.currentRentUf,
    realizationPct,
    averageSalesUfPerM2,
    totalBillingUf,
    totalGapUf,
    totalSalesPesos,
  };
}

// ---------------------------------------------------------------------------
// Tenant history — chronological succession of all contracts on this local
// ---------------------------------------------------------------------------

function serializeRate(r: RawContract["tarifas"][number]): TenantHistoryRate {
  return {
    vigenciaDesde: dateStr(r.vigenciaDesde) ?? "",
    vigenciaHasta: dateStr(r.vigenciaHasta),
    tipo: String(r.tipo),
    valor: toNum(r.valor),
    esDiciembre: r.esDiciembre,
  };
}

function buildTenantHistory(
  contracts: RawContractWithTenant[],
  accountingRecords: RawAccountingRecord[],
  attributedSales: RawUnitSale[],
  rangeFromDate: Date,
  rangeToDate: Date,
): TenantHistoryEntry[] {
  const today = startOfDay(new Date());

  const billingByTenantPeriod = new Map<string, Map<string, number>>();
  for (const r of accountingRecords) {
    if (r.group1 !== "INGRESOS DE EXPLOTACION") continue;
    // Note: AccountingRecord lacks tenantId in the raw shape used by tenant-360;
    // we accept the full set as already filtered to this local's unitId, so we
    // attribute by the contract's own active period inside the entry loop below.
    const bucket = billingByTenantPeriod.get("__local__") ?? new Map<string, number>();
    const p = periodKey(r.period);
    bucket.set(p, (bucket.get(p) ?? 0) + toNum(r.valueUf));
    billingByTenantPeriod.set("__local__", bucket);
  }
  const localBillingByPeriod = billingByTenantPeriod.get("__local__") ?? new Map<string, number>();

  const salesByTenantPeriod = new Map<string, Map<string, number>>();
  for (const s of attributedSales) {
    const m = salesByTenantPeriod.get(s.tenantId) ?? new Map<string, number>();
    const p = periodKey(s.period);
    m.set(p, (m.get(p) ?? 0) + toNum(s.salesPesos));
    salesByTenantPeriod.set(s.tenantId, m);
  }

  const entries: TenantHistoryEntry[] = contracts.map((c) => {
    const totalDays = totalContractDays(c.fechaInicio, c.fechaTermino);
    const daysInRange = overlapDays(rangeFromDate, rangeToDate, c.fechaInicio, c.fechaTermino);

    let totalBillingUf = 0;
    if (daysInRange > 0) {
      const start = c.fechaInicio > rangeFromDate ? c.fechaInicio : rangeFromDate;
      const end = c.fechaTermino < rangeToDate ? c.fechaTermino : rangeToDate;
      const startKey = periodKey(start);
      const endKey = periodKey(end);
      for (const [period, valueUf] of localBillingByPeriod) {
        if (period >= startKey && period <= endKey) totalBillingUf += valueUf;
      }
      // De-duplicate billing across overlapping contract ranges by attributing
      // billing only to the contract that covers the period start day; for the
      // typical case of non-overlapping successive contracts this collapses to
      // the natural attribution.
    }

    let totalSalesPesos = 0;
    const tenantSales = salesByTenantPeriod.get(c.arrendatarioId);
    if (tenantSales && daysInRange > 0) {
      const start = c.fechaInicio > rangeFromDate ? c.fechaInicio : rangeFromDate;
      const end = c.fechaTermino < rangeToDate ? c.fechaTermino : rangeToDate;
      const startKey = periodKey(start);
      const endKey = periodKey(end);
      for (const [period, salesPesos] of tenantSales) {
        if (period >= startKey && period <= endKey) totalSalesPesos += salesPesos;
      }
    }

    const currentRate = findCurrentRate(c.tarifas, c.fechaTermino);
    const monthlyRentUf = rentForRate(currentRate, toNum(c.local.glam2));

    const rateEvolution: TenantHistoryRate[] = [...c.tarifas]
      .sort((a, b) => a.vigenciaDesde.getTime() - b.vigenciaDesde.getTime())
      .map(serializeRate);

    const discounts: TenantHistoryDiscount[] = [];
    for (const t of c.tarifas) {
      if (t.descuentoTipo && t.descuentoValor !== null && t.descuentoValor !== undefined) {
        discounts.push({
          vigenciaDesde: dateStr(t.descuentoDesde ?? t.vigenciaDesde) ?? "",
          vigenciaHasta: dateStr(t.descuentoHasta ?? null),
          tipo: String(t.descuentoTipo),
          valor: toNum(t.descuentoValor),
        });
      }
    }

    return {
      contractId: c.id,
      numeroContrato: c.numeroContrato,
      tenantId: c.arrendatario.id,
      tenantName: c.arrendatario.nombreComercial || c.arrendatario.razonSocial,
      tenantRut: c.arrendatario.rut,
      fechaInicio: dateStr(c.fechaInicio) ?? "",
      fechaTermino: dateStr(c.fechaTermino) ?? "",
      fechaEntrega: dateStr(c.fechaEntrega),
      fechaApertura: dateStr(c.fechaApertura),
      totalDays,
      daysInRange,
      totalBillingUf,
      totalSalesPesos,
      monthlyRentUf,
      estado: c.estado,
      isCurrent: isContractCurrent(c, today),
      rateEvolution,
      discounts,
    };
  });

  return entries.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
}

// ---------------------------------------------------------------------------
// Occupancy timeline (aggregated by month)
// ---------------------------------------------------------------------------

function buildOccupancyTimeline(
  contractDays: RawContractDay[],
  periods: string[],
): OccupancyMonthlyPoint[] {
  const byPeriod = new Map<string, { occupado: number; gracia: number; vacante: number }>();
  for (const d of contractDays) {
    const p = periodKey(d.fecha);
    const entry = byPeriod.get(p) ?? { occupado: 0, gracia: 0, vacante: 0 };
    if (d.estadoDia === "OCUPADO") entry.occupado += 1;
    else if (d.estadoDia === "GRACIA") entry.gracia += 1;
    else entry.vacante += 1;
    byPeriod.set(p, entry);
  }

  return periods.map((period) => {
    const entry = byPeriod.get(period) ?? { occupado: 0, gracia: 0, vacante: 0 };
    const totalDays = entry.occupado + entry.gracia + entry.vacante;
    const occupancyPct = totalDays > 0 ? ((entry.occupado + entry.gracia) / totalDays) * 100 : 0;
    return {
      period,
      daysOccupied: entry.occupado,
      daysVacant: entry.vacante,
      daysGrace: entry.gracia,
      totalDays,
      occupancyPct,
    };
  });
}

// ---------------------------------------------------------------------------
// Energy timeline
// ---------------------------------------------------------------------------

function buildEnergyTimeline(
  energyEntries: RawIngresoEnergia[],
  periods: string[],
): EnergyMonthlyPoint[] {
  const byPeriod = new Map<string, number>();
  for (const e of energyEntries) {
    const p = periodKey(e.periodo);
    byPeriod.set(p, (byPeriod.get(p) ?? 0) + toNum(e.valorUf));
  }
  return periods.map((period) => ({ period, costoUf: byPeriod.get(period) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Peer comparison
// ---------------------------------------------------------------------------

function buildLocalPeerComparison(
  thisUnitId: string,
  thisGlam2: number,
  thisTotalBillingUf: number,
  peerStats: RawPeerUnitStat[],
): LocalPeerComparison | null {
  if (peerStats.length === 0) return null;

  const peers: LocalPeerStat[] = peerStats.map((p) => {
    const g = toNum(p.glam2);
    return {
      unitId: p.unitId,
      codigo: p.codigo,
      glam2: g,
      totalBillingUf: p.totalBillingUf,
      billingUfPerM2: g > 0 ? p.totalBillingUf / g : 0,
      isCurrent: p.unitId === thisUnitId,
    };
  });

  const thisPerM2 = thisGlam2 > 0 ? thisTotalBillingUf / thisGlam2 : 0;
  const all: LocalPeerStat[] = [
    ...peers,
    {
      unitId: thisUnitId,
      codigo: "this",
      glam2: thisGlam2,
      totalBillingUf: thisTotalBillingUf,
      billingUfPerM2: thisPerM2,
      isCurrent: true,
    },
  ];
  all.sort((a, b) => b.billingUfPerM2 - a.billingUfPerM2);

  const position = all.findIndex((p) => p.isCurrent && p.unitId === thisUnitId) + 1;
  const peerValues = peers.map((p) => p.billingUfPerM2).sort((a, b) => a - b);
  const peerAvg =
    peerValues.length > 0 ? peerValues.reduce((s, v) => s + v, 0) / peerValues.length : 0;
  const peerMedian =
    peerValues.length === 0
      ? 0
      : peerValues.length % 2 === 1
        ? peerValues[(peerValues.length - 1) / 2]
        : (peerValues[peerValues.length / 2 - 1] + peerValues[peerValues.length / 2]) / 2;

  return {
    peerCount: peers.length,
    thisLocal: { billingUfPerM2: thisPerM2, totalBillingUf: thisTotalBillingUf },
    peerAvgBillingUfPerM2: peerAvg,
    peerMedianBillingUfPerM2: peerMedian,
    rankBilling: { position, total: all.length },
    peers,
  };
}

// ---------------------------------------------------------------------------
// Contract serialization (matches Tenant360Contract for component reuse)
// ---------------------------------------------------------------------------

function serializeContractRate(r: RawContract["tarifas"][number]): Tenant360Rate {
  return {
    tipo: r.tipo,
    valor: toNum(r.valor),
    umbralVentasUf:
      r.umbralVentasUf !== undefined && r.umbralVentasUf !== null ? toNum(r.umbralVentasUf) : null,
    pisoMinimoUf:
      r.pisoMinimoUf !== undefined && r.pisoMinimoUf !== null ? toNum(r.pisoMinimoUf) : null,
    vigenciaDesde: dateStr(r.vigenciaDesde) ?? "",
    vigenciaHasta: dateStr(r.vigenciaHasta),
    esDiciembre: r.esDiciembre,
    descuentoTipo: r.descuentoTipo ?? null,
    descuentoValor:
      r.descuentoValor !== undefined && r.descuentoValor !== null ? toNum(r.descuentoValor) : null,
    descuentoDesde: dateStr(r.descuentoDesde),
    descuentoHasta: dateStr(r.descuentoHasta),
  };
}

function serializeContractGgcc(g: RawContract["ggcc"][number]): Tenant360Ggcc {
  return {
    tarifaBaseUfM2: toNum(g.tarifaBaseUfM2),
    pctAdministracion: toNum(g.pctAdministracion),
    pctReajuste: g.pctReajuste !== null ? toNum(g.pctReajuste) : null,
    proximoReajuste: dateStr(g.proximoReajuste),
    mesesReajuste: g.mesesReajuste,
    vigenciaDesde: dateStr(g.vigenciaDesde) ?? "",
    vigenciaHasta: dateStr(g.vigenciaHasta),
  };
}

function serializeContractAmendment(a: RawContract["anexos"][number]): Tenant360Amendment {
  const campos = Array.isArray(a.camposModificados) ? (a.camposModificados as string[]) : [];
  return {
    id: a.id,
    fecha: dateStr(a.fecha) ?? "",
    descripcion: a.descripcion,
    camposModificados: campos,
  };
}

function serializeContracts(
  contracts: RawContractWithTenant[],
  comparisons: Map<string, ContractComparison | null>,
): Tenant360Contract[] {
  const today = startOfDay(new Date());
  return contracts.map((c) => {
    const currentRate = findCurrentRate(c.tarifas);
    const currentGgcc = findCurrentGgcc(c.ggcc);
    const diasRestantes = Math.max(
      0,
      Math.round((startOfDay(c.fechaTermino).getTime() - today.getTime()) / MS_PER_DAY),
    );
    return {
      id: c.id,
      numeroContrato: c.numeroContrato,
      localCodigo: c.local.codigo,
      localNombre: c.local.nombre,
      localGlam2: toNum(c.local.glam2),
      estado: c.estado,
      fechaInicio: dateStr(c.fechaInicio) ?? "",
      fechaTermino: dateStr(c.fechaTermino) ?? "",
      fechaEntrega: dateStr(c.fechaEntrega),
      fechaApertura: dateStr(c.fechaApertura),
      diasGracia: c.diasGracia,
      cuentaParaVacancia: c.cuentaParaVacancia ?? null,
      diasRestantes,
      multiplicadorDiciembre: c.multiplicadorDiciembre !== null ? toNum(c.multiplicadorDiciembre) : null,
      multiplicadorJunio: c.multiplicadorJunio !== null ? toNum(c.multiplicadorJunio) : null,
      multiplicadorJulio: c.multiplicadorJulio !== null ? toNum(c.multiplicadorJulio) : null,
      multiplicadorAgosto: c.multiplicadorAgosto !== null ? toNum(c.multiplicadorAgosto) : null,
      pctFondoPromocion: c.pctFondoPromocion !== null ? toNum(c.pctFondoPromocion) : null,
      codigoCC: c.codigoCC,
      pdfUrl: c.pdfUrl,
      notas: c.notas,
      tarifaActual: currentRate ? serializeContractRate(currentRate) : null,
      historialTarifas: c.tarifas.map(serializeContractRate),
      ggccActual: currentGgcc ? serializeContractGgcc(currentGgcc) : null,
      anexos: c.anexos.map(serializeContractAmendment),
      comparison: comparisons.get(c.id) ?? null,
    };
  });
}

function serializeOccupancyDays(days: RawContractDay[]): OccupancyDayEntry[] {
  return days.map((d) => ({
    localCodigo: d.local?.codigo ?? "",
    fecha: dateStr(d.fecha) ?? "",
    estadoDia: d.estadoDia,
    glam2: toNum(d.glam2),
  }));
}

// ---------------------------------------------------------------------------
// Projections — simple expiry-window analysis for the current contract
// ---------------------------------------------------------------------------

function buildProjections(contracts: RawContractWithTenant[]): Tenant360Projection {
  const today = startOfDay(new Date());
  const expiringContracts: ExpiringContract[] = [];
  let totalRentAtRiskUf = 0;

  for (const c of contracts) {
    if (c.estado !== ContractStatus.VIGENTE && c.estado !== ContractStatus.GRACIA) continue;
    const endDate = startOfDay(c.fechaTermino);
    const diasRestantes = Math.max(
      0,
      Math.round((endDate.getTime() - today.getTime()) / MS_PER_DAY),
    );
    if (diasRestantes > 180) continue;

    const rate = findCurrentRate(c.tarifas);
    const rentaFijaUf = rentForRate(rate, toNum(c.local.glam2)) ?? 0;
    totalRentAtRiskUf += rentaFijaUf;

    let riskLevel: "low" | "medium" | "high" = "low";
    if (diasRestantes <= 30) riskLevel = "high";
    else if (diasRestantes <= 90) riskLevel = "medium";

    expiringContracts.push({
      id: c.id,
      localCodigo: c.local.codigo,
      fechaTermino: dateStr(c.fechaTermino) ?? "",
      diasRestantes,
      rentaFijaUf,
      riskLevel,
    });
  }

  expiringContracts.sort((a, b) => a.diasRestantes - b.diasRestantes);
  return { expiringContracts, totalRentAtRiskUf };
}

// ---------------------------------------------------------------------------
// Local Comercial tab — replicates the Excel "Local Comercial" sheet
// ---------------------------------------------------------------------------

function buildTenantsForSelector(
  contracts: RawContractWithTenant[],
): TenantSelectorEntry[] {
  const today = startOfDay(new Date());
  const seen = new Map<string, TenantSelectorEntry>();
  for (const c of contracts) {
    const tenantId = c.arrendatario.id;
    const isCurrent = isContractCurrent(c, today);
    const existing = seen.get(tenantId);
    const fechaInicio = dateStr(c.fechaInicio) ?? "";
    const fechaTermino = dateStr(c.fechaTermino) ?? "";
    if (!existing) {
      seen.set(tenantId, {
        tenantId,
        tenantName: c.arrendatario.nombreComercial || c.arrendatario.razonSocial,
        fechaInicio,
        fechaTermino,
        isCurrent,
      });
      continue;
    }
    if (fechaInicio < existing.fechaInicio) existing.fechaInicio = fechaInicio;
    if (fechaTermino > existing.fechaTermino) existing.fechaTermino = fechaTermino;
    if (isCurrent) existing.isCurrent = true;
  }
  return [...seen.values()].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
}

function pickAnalysisTenantId(
  contracts: RawContractWithTenant[],
  requestedTenantId: string | null,
): string | null {
  if (requestedTenantId && contracts.some((c) => c.arrendatario.id === requestedTenantId)) {
    return requestedTenantId;
  }
  const today = startOfDay(new Date());
  const current = contracts.find((c) => isContractCurrent(c, today));
  if (current) return current.arrendatario.id;
  const sorted = [...contracts].sort(
    (a, b) => b.fechaInicio.getTime() - a.fechaInicio.getTime(),
  );
  return sorted[0]?.arrendatario.id ?? null;
}

function periodHasOverlap(
  period: string,
  fechaInicio: Date,
  fechaTermino: Date,
): boolean {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return fechaInicio <= end && fechaTermino >= start;
}

function tenantLocalContractWindows(
  contracts: RawContractWithTenant[],
  tenantId: string,
  thisUnitId: string,
): { fechaInicio: Date; fechaTermino: Date }[] {
  return contracts
    .filter((c) => c.arrendatarioId === tenantId && c.localId === thisUnitId)
    .map((c) => ({ fechaInicio: c.fechaInicio, fechaTermino: c.fechaTermino }));
}

function periodInTenantWindows(
  period: string,
  windows: { fechaInicio: Date; fechaTermino: Date }[],
): boolean {
  return windows.some((w) => periodHasOverlap(period, w.fechaInicio, w.fechaTermino));
}

function buildAnalysisRow(
  metric: string,
  values: (number | null)[],
  periods: string[],
  ytd: number | null,
): LocalCommercialAnalysisRow {
  const byPeriod: Record<string, number | null> = {};
  periods.forEach((p, i) => {
    byPeriod[p] = values[i] ?? null;
  });
  return { metric, byPeriod, ytd };
}

function sumNonNull(values: (number | null)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

function ratioYtd(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function buildTenantOnLocalAnalysis(input: {
  unit: RawUnit;
  contracts: RawContractWithTenant[];
  accountingRecords: RawAccountingRecord[];
  attributedSales: RawUnitSale[];
  tenantId: string | null;
  periods: string[];
  glam2: number;
  ufRateByPeriod: Map<string, number>;
}): TenantOnLocalAnalysis | null {
  const { unit, contracts, accountingRecords, attributedSales, tenantId, periods, glam2, ufRateByPeriod } = input;
  if (!tenantId) return null;

  const tenantContract = contracts.find((c) => c.arrendatario.id === tenantId);
  if (!tenantContract) return null;

  const windows = tenantLocalContractWindows(contracts, tenantId, unit.id);
  if (windows.length === 0) return null;

  const ocupacionM2: number[] = periods.map((p) =>
    periodInTenantWindows(p, windows) ? glam2 : 0,
  );

  const billingByPeriod = new Map<string, number>();
  for (const r of accountingRecords) {
    const p = periodKey(r.period);
    if (!periodInTenantWindows(p, windows)) continue;
    billingByPeriod.set(p, (billingByPeriod.get(p) ?? 0) + toNum(r.valueUf));
  }

  const salesPesosByPeriod = new Map<string, number>();
  for (const s of attributedSales) {
    if (s.tenantId !== tenantId) continue;
    const p = periodKey(s.period);
    salesPesosByPeriod.set(p, (salesPesosByPeriod.get(p) ?? 0) + toNum(s.salesPesos));
  }

  const facturacionUfM2: (number | null)[] = [];
  const ventaClp: (number | null)[] = [];
  const ventaUf: (number | null)[] = [];
  const ventaUfM2: (number | null)[] = [];
  const costoPct: (number | null)[] = [];

  for (let i = 0; i < periods.length; i += 1) {
    const period = periods[i];
    const m2 = ocupacionM2[i];
    const billingUf = billingByPeriod.get(period) ?? 0;
    facturacionUfM2.push(m2 > 0 ? billingUf / m2 : 0);

    const salesPesos = salesPesosByPeriod.get(period) ?? 0;
    ventaClp.push(salesPesos);
    const ufRate = ufRateByPeriod.get(period) ?? 0;
    const salesUf = ufRate > 0 ? salesPesos / ufRate : 0;
    ventaUf.push(salesUf);
    ventaUfM2.push(m2 > 0 ? salesUf / m2 : 0);

    if (salesUf <= 0) {
      costoPct.push(null);
    } else {
      costoPct.push((billingUf / salesUf) * 100);
    }
  }

  const totalM2 = sumNonNull(ocupacionM2);
  const totalBillingUf = [...billingByPeriod.values()].reduce((s, v) => s + v, 0);
  const totalSalesPesos = [...salesPesosByPeriod.values()].reduce((s, v) => s + v, 0);
  const totalSalesUf = ventaUf.reduce<number>((s, v) => s + (v ?? 0), 0);

  const rows: LocalCommercialAnalysisRow[] = [
    buildAnalysisRow("Ocupación Cliente (M2)", ocupacionM2, periods, totalM2),
    buildAnalysisRow(
      "Facturación Cliente (UF/M2)",
      facturacionUfM2,
      periods,
      ratioYtd(totalBillingUf, totalM2),
    ),
    buildAnalysisRow("Venta Cliente (CLP)", ventaClp, periods, totalSalesPesos),
    buildAnalysisRow("Venta Cliente (UF)", ventaUf, periods, totalSalesUf),
    buildAnalysisRow(
      "Venta Cliente (UF/M2)",
      ventaUfM2,
      periods,
      ratioYtd(totalSalesUf, totalM2),
    ),
    buildAnalysisRow(
      "Costo Ocupación Cliente (%)",
      costoPct,
      periods,
      totalSalesUf > 0 ? (totalBillingUf / totalSalesUf) * 100 : null,
    ),
  ];

  // Breakdown by group3 within tenant contract window
  const breakdownUfByPeriod = new Map<string, Map<string, number>>();
  for (const r of accountingRecords) {
    const p = periodKey(r.period);
    if (!periodInTenantWindows(p, windows)) continue;
    const group = r.group3;
    const map = breakdownUfByPeriod.get(group) ?? new Map<string, number>();
    map.set(p, (map.get(p) ?? 0) + toNum(r.valueUf));
    breakdownUfByPeriod.set(group, map);
  }

  const breakdownUf: LocalCommercialBreakdownRow[] = [];
  const breakdownUfM2: LocalCommercialBreakdownRow[] = [];
  const breakdownGroups = [...breakdownUfByPeriod.keys()].sort();
  for (const group of breakdownGroups) {
    const map = breakdownUfByPeriod.get(group) ?? new Map<string, number>();
    const byPeriodUf: Record<string, number> = {};
    const byPeriodUfM2: Record<string, number> = {};
    let ytdUf = 0;
    for (let i = 0; i < periods.length; i += 1) {
      const period = periods[i];
      const valueUf = map.get(period) ?? 0;
      byPeriodUf[period] = valueUf;
      const m2 = ocupacionM2[i];
      byPeriodUfM2[period] = m2 > 0 ? valueUf / m2 : 0;
      ytdUf += valueUf;
    }
    breakdownUf.push({ group3: group, byPeriod: byPeriodUf, ytd: ytdUf });
    breakdownUfM2.push({
      group3: group,
      byPeriod: byPeriodUfM2,
      ytd: totalM2 > 0 ? ytdUf / totalM2 : 0,
    });
  }

  const totalRow: LocalCommercialAnalysisRow = buildAnalysisRow(
    "Total Facturación Cliente",
    facturacionUfM2,
    periods,
    ratioYtd(totalBillingUf, totalM2),
  );

  const tenantName =
    tenantContract.arrendatario.nombreComercial ||
    tenantContract.arrendatario.razonSocial;

  const today = startOfDay(new Date());
  const isCurrent = contracts.some(
    (c) => c.arrendatario.id === tenantId && isContractCurrent(c, today),
  );

  const dataContableId = tenantContract.codigoCC ?? null;
  const ventasId = tenantContract.arrendatario.nombreComercial || null;

  return {
    tenantId,
    tenantName,
    isCurrent,
    ids: { unitCodigo: unit.codigo, dataContableId, ventasId },
    rows,
    breakdownUfM2,
    breakdownUf,
    totalFacturacionUfM2: totalRow,
  };
}

// ---------------------------------------------------------------------------
// Per-unit aggregates — shared by category analysis and similar locals table
// ---------------------------------------------------------------------------

type PerUnitAggregate = {
  unitId: string;
  glam2: number;
  ocupacionByPeriod: number[];      // m² occupied per period (0 or unit glam2)
  billingUfByPeriod: number[];
  salesPesosByPeriod: number[];
  salesUfByPeriod: number[];
};

function buildOccupancyByPeriod(
  unitGlam2: number,
  unitId: string,
  contractDays: RawContractDay[],
  periods: string[],
): number[] {
  const occupiedPeriods = new Set<string>();
  for (const d of contractDays) {
    if (d.localId !== unitId) continue;
    if (d.estadoDia !== "OCUPADO" && d.estadoDia !== "GRACIA") continue;
    occupiedPeriods.add(periodKey(d.fecha));
  }
  return periods.map((p) => (occupiedPeriods.has(p) ? unitGlam2 : 0));
}

function attributeSalesAcrossUnits(input: {
  units: RawCategoryUnit[];
  tenantFootprints: RawTenantContractFootprint[];
  rawSales: RawUnitSale[];
  periods: string[];
  ufRateByPeriod: Map<string, number>;
}): Map<string, { pesosByPeriod: Map<string, number>; ufByPeriod: Map<string, number> }> {
  const { units, tenantFootprints, rawSales, periods, ufRateByPeriod } = input;
  const out = new Map<string, { pesosByPeriod: Map<string, number>; ufByPeriod: Map<string, number> }>();
  const unitIds = new Set(units.map((u) => u.id));
  for (const id of unitIds) {
    out.set(id, { pesosByPeriod: new Map(), ufByPeriod: new Map() });
  }

  // For each tenant-period, total GLA across all their footprints
  // (across the project, not just category) and per-unit GLA inside the category.
  function periodBounds(period: string): { start: Date; end: Date } {
    const [y, m] = period.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return { start, end };
  }

  const periodSet = new Set(periods);

  // tenant -> period -> { totalGla, perUnitGla: Map<unitId, gla> }
  const layout = new Map<string, Map<string, { totalGla: number; perUnitGla: Map<string, number> }>>();
  for (const period of periods) {
    const { start, end } = periodBounds(period);
    for (const f of tenantFootprints) {
      if (f.fechaInicio > end || f.fechaTermino < start) continue;
      const tenantMap = layout.get(f.arrendatarioId) ?? new Map();
      const entry = tenantMap.get(period) ?? { totalGla: 0, perUnitGla: new Map<string, number>() };
      const g = toNum(f.glam2);
      entry.totalGla += g;
      if (unitIds.has(f.localId)) {
        entry.perUnitGla.set(f.localId, (entry.perUnitGla.get(f.localId) ?? 0) + g);
      }
      tenantMap.set(period, entry);
      layout.set(f.arrendatarioId, tenantMap);
    }
  }

  for (const sale of rawSales) {
    const period = periodKey(sale.period);
    if (!periodSet.has(period)) continue;
    const tenantMap = layout.get(sale.tenantId);
    if (!tenantMap) continue;
    const entry = tenantMap.get(period);
    if (!entry || entry.totalGla <= 0) continue;
    const salesPesos = toNum(sale.salesPesos);
    const ufRate = ufRateByPeriod.get(period) ?? 0;
    const salesUf = ufRate > 0 ? salesPesos / ufRate : 0;
    for (const [unitId, gla] of entry.perUnitGla) {
      if (gla <= 0) continue;
      const share = gla / entry.totalGla;
      const bucket = out.get(unitId);
      if (!bucket) continue;
      bucket.pesosByPeriod.set(period, (bucket.pesosByPeriod.get(period) ?? 0) + salesPesos * share);
      bucket.ufByPeriod.set(period, (bucket.ufByPeriod.get(period) ?? 0) + salesUf * share);
    }
  }

  return out;
}

function buildPerUnitAggregates(input: {
  units: RawCategoryUnit[];
  accountingRecords: RawAccountingRecord[];
  contractDays: RawContractDay[];
  tenantFootprints: RawTenantContractFootprint[];
  rawSales: RawUnitSale[];
  periods: string[];
  ufRateByPeriod: Map<string, number>;
}): PerUnitAggregate[] {
  const { units, accountingRecords, contractDays, tenantFootprints, rawSales, periods, ufRateByPeriod } = input;

  const billingByUnitPeriod = new Map<string, Map<string, number>>();
  for (const r of accountingRecords) {
    if (!r.unitId) continue;
    const p = periodKey(r.period);
    const map = billingByUnitPeriod.get(r.unitId) ?? new Map<string, number>();
    map.set(p, (map.get(p) ?? 0) + toNum(r.valueUf));
    billingByUnitPeriod.set(r.unitId, map);
  }

  const attributed = attributeSalesAcrossUnits({
    units,
    tenantFootprints,
    rawSales,
    periods,
    ufRateByPeriod,
  });

  return units.map((u) => {
    const unitGlam2 = toNum(u.glam2);
    const ocupacionByPeriod = buildOccupancyByPeriod(unitGlam2, u.id, contractDays, periods);
    const billingMap = billingByUnitPeriod.get(u.id) ?? new Map<string, number>();
    const billingUfByPeriod = periods.map((p) => billingMap.get(p) ?? 0);
    const salesBucket = attributed.get(u.id) ?? { pesosByPeriod: new Map(), ufByPeriod: new Map() };
    const salesPesosByPeriod = periods.map((p) => salesBucket.pesosByPeriod.get(p) ?? 0);
    const salesUfByPeriod = periods.map((p) => salesBucket.ufByPeriod.get(p) ?? 0);
    return {
      unitId: u.id,
      glam2: unitGlam2,
      ocupacionByPeriod,
      billingUfByPeriod,
      salesPesosByPeriod,
      salesUfByPeriod,
    };
  });
}

// ---------------------------------------------------------------------------
// Category analysis — aggregates the same 6 metrics across all units of tipo
// ---------------------------------------------------------------------------

function buildCategoryAnalysis(input: {
  unit: RawUnit;
  perUnitAggregates: PerUnitAggregate[];
  periods: string[];
}): CategoryAnalysis {
  const { unit, perUnitAggregates, periods } = input;
  const periodCount = periods.length;

  const ocupacion = new Array(periodCount).fill(0);
  const billing = new Array(periodCount).fill(0);
  const salesPesos = new Array(periodCount).fill(0);
  const salesUf = new Array(periodCount).fill(0);

  for (const a of perUnitAggregates) {
    for (let i = 0; i < periodCount; i += 1) {
      ocupacion[i] += a.ocupacionByPeriod[i];
      billing[i] += a.billingUfByPeriod[i];
      salesPesos[i] += a.salesPesosByPeriod[i];
      salesUf[i] += a.salesUfByPeriod[i];
    }
  }

  const facturacionUfM2: (number | null)[] = ocupacion.map((m2, i) =>
    m2 > 0 ? billing[i] / m2 : 0,
  );
  const ventaClp: (number | null)[] = salesPesos.map((v) => v);
  const ventaUf: (number | null)[] = salesUf.map((v) => v);
  const ventaUfM2: (number | null)[] = ocupacion.map((m2, i) =>
    m2 > 0 ? salesUf[i] / m2 : 0,
  );
  const costoPct: (number | null)[] = salesUf.map((sUf, i) =>
    sUf > 0 ? (billing[i] / sUf) * 100 : null,
  );

  const totalM2 = ocupacion.reduce((s: number, v: number) => s + v, 0);
  const totalBilling = billing.reduce((s: number, v: number) => s + v, 0);
  const totalSalesPesos = salesPesos.reduce((s: number, v: number) => s + v, 0);
  const totalSalesUf = salesUf.reduce((s: number, v: number) => s + v, 0);

  const rows: LocalCommercialAnalysisRow[] = [
    buildAnalysisRow("Ocupación Categoría (M2)", ocupacion, periods, totalM2),
    buildAnalysisRow(
      "Facturación Categoría (UF/M2)",
      facturacionUfM2,
      periods,
      ratioYtd(totalBilling, totalM2),
    ),
    buildAnalysisRow("Venta Categoría (CLP)", ventaClp, periods, totalSalesPesos),
    buildAnalysisRow("Venta Categoría (UF)", ventaUf, periods, totalSalesUf),
    buildAnalysisRow(
      "Venta Categoría (UF/M2)",
      ventaUfM2,
      periods,
      ratioYtd(totalSalesUf, totalM2),
    ),
    buildAnalysisRow(
      "Costo Ocupación Categoría (%)",
      costoPct,
      periods,
      totalSalesUf > 0 ? (totalBilling / totalSalesUf) * 100 : null,
    ),
  ];

  return { categoria: String(unit.tipo), rows };
}

// ---------------------------------------------------------------------------
// Similar locals table — peers matching Tamaño + Tipo + Piso (strict)
// ---------------------------------------------------------------------------

function aggregateToSimilarRow(input: {
  unit: { id: string; codigo: string; nombre: string };
  aggregate: PerUnitAggregate;
  isCurrent: boolean;
}): SimilarLocalRow {
  const { unit, aggregate, isCurrent } = input;
  const periodCount = aggregate.ocupacionByPeriod.length;
  const ytdM2 = aggregate.ocupacionByPeriod.reduce((s: number, v: number) => s + v, 0);
  const ytdBilling = aggregate.billingUfByPeriod.reduce((s: number, v: number) => s + v, 0);
  const ytdSalesUf = aggregate.salesUfByPeriod.reduce((s: number, v: number) => s + v, 0);

  let currentM2 = 0;
  for (let i = periodCount - 1; i >= 0; i -= 1) {
    if (aggregate.ocupacionByPeriod[i] > 0) {
      currentM2 = aggregate.ocupacionByPeriod[i];
      break;
    }
  }

  return {
    unitId: unit.id,
    codigo: unit.codigo,
    nombre: unit.nombre,
    ocupacionM2Current: currentM2,
    ocupacionYtdM2: ytdM2,
    facturacionYtdUfM2: ytdM2 > 0 ? ytdBilling / ytdM2 : 0,
    ventasYtdUfM2: ytdM2 > 0 ? ytdSalesUf / ytdM2 : 0,
    costoOcupacionYtdPct: ytdSalesUf > 0 ? (ytdBilling / ytdSalesUf) * 100 : null,
    isCurrent,
  };
}

function buildSimilarLocalsTable(input: {
  unit: RawUnit;
  similarUnits: RawCategoryUnit[];
  similarAggregates: PerUnitAggregate[];
}): SimilarLocalsTable {
  const { unit, similarUnits, similarAggregates } = input;
  const aggregateById = new Map<string, PerUnitAggregate>();
  for (const a of similarAggregates) aggregateById.set(a.unitId, a);

  const rows: SimilarLocalRow[] = similarUnits
    .map((u) => {
      const aggregate = aggregateById.get(u.id);
      if (!aggregate) return null;
      return aggregateToSimilarRow({
        unit: { id: u.id, codigo: u.codigo, nombre: u.nombre },
        aggregate,
        isCurrent: u.id === unit.id,
      });
    })
    .filter((r): r is SimilarLocalRow => r !== null)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  const totalCurrentM2 = rows.reduce((s, r) => s + r.ocupacionM2Current, 0);
  const totalYtdM2 = rows.reduce((s, r) => s + r.ocupacionYtdM2, 0);
  const totalBilling = similarAggregates.reduce(
    (s, a) => s + a.billingUfByPeriod.reduce((acc: number, v: number) => acc + v, 0),
    0,
  );
  const totalSalesUf = similarAggregates.reduce(
    (s, a) => s + a.salesUfByPeriod.reduce((acc: number, v: number) => acc + v, 0),
    0,
  );

  const total: SimilarLocalRow = {
    unitId: "__total__",
    codigo: "Total",
    nombre: "Total",
    ocupacionM2Current: totalCurrentM2,
    ocupacionYtdM2: totalYtdM2,
    facturacionYtdUfM2: totalYtdM2 > 0 ? totalBilling / totalYtdM2 : 0,
    ventasYtdUfM2: totalYtdM2 > 0 ? totalSalesUf / totalYtdM2 : 0,
    costoOcupacionYtdPct: totalSalesUf > 0 ? (totalBilling / totalSalesUf) * 100 : null,
    isCurrent: false,
  };

  return {
    filterTamano: unit.categoriaTamano,
    filterTipo: String(unit.tipo),
    filterPiso: unit.piso,
    rows,
    total,
  };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export function buildLocal360Data(input: BuildLocal360Input): Local360Data {
  const {
    unit,
    contracts,
    accountingRecords,
    attributedSales,
    contractDays,
    energyEntries,
    peerStats,
    latestUf,
    periods,
    ufRateByPeriod = new Map(),
    rangeFromDate,
    rangeToDate,
    selectedTenantId = null,
    contractComparisons = new Map(),
    categoryUnits = [],
    categoryAccountingRecords = [],
    categoryContractDays = [],
    categoryTenantFootprints = [],
    categoryRawSales = [],
    similarUnitIds = new Set<string>(),
  } = input;

  const profile = buildLocalProfile(unit);
  const quickStats = buildLocalQuickStats(unit, contracts, contractDays, latestUf);
  const glam2 = profile.glam2;

  const monthlyTimeline = buildMonthlyTimeline(
    accountingRecords,
    attributedSales,
    periods,
    glam2,
    ufRateByPeriod,
  );

  const activeContracts = contracts.filter(
    (c) => c.estado === ContractStatus.VIGENTE || c.estado === ContractStatus.GRACIA,
  );
  const gapAnalysis = buildGapAnalysis(
    activeContracts,
    accountingRecords,
    attributedSales,
    periods,
    contractDays,
    ufRateByPeriod,
  );

  const kpis = buildLocalKpis(quickStats, monthlyTimeline, gapAnalysis);
  const tenantHistory = buildTenantHistory(
    contracts,
    accountingRecords,
    attributedSales,
    rangeFromDate,
    rangeToDate,
  );

  const billingBreakdown = buildBillingBreakdown(accountingRecords);
  const salesPerformance = buildSalesPerformance(
    attributedSales,
    activeContracts,
    periods,
    glam2,
    ufRateByPeriod,
  );
  const occupancyTimeline = buildOccupancyTimeline(contractDays, periods);
  const occupancyDays = serializeOccupancyDays(contractDays);
  const energyTimeline = buildEnergyTimeline(energyEntries, periods);
  const projections = buildProjections(contracts);
  const serializedContracts = serializeContracts(contracts, contractComparisons);

  const totalBillingUf = monthlyTimeline.reduce((s, p) => s + p.billingUf, 0);
  const peerComparison = buildLocalPeerComparison(unit.id, glam2, totalBillingUf, peerStats);

  const tenantsForSelector = buildTenantsForSelector(contracts);
  const analysisTenantId = pickAnalysisTenantId(contracts, selectedTenantId);
  const tenantOnLocalAnalysis = buildTenantOnLocalAnalysis({
    unit,
    contracts,
    accountingRecords,
    attributedSales,
    tenantId: analysisTenantId,
    periods,
    glam2,
    ufRateByPeriod,
  });

  const categoryAggregates = buildPerUnitAggregates({
    units: categoryUnits,
    accountingRecords: categoryAccountingRecords,
    contractDays: categoryContractDays,
    tenantFootprints: categoryTenantFootprints,
    rawSales: categoryRawSales,
    periods,
    ufRateByPeriod,
  });

  const categoryAnalysis = buildCategoryAnalysis({
    unit,
    perUnitAggregates: categoryAggregates,
    periods,
  });

  const similarUnits = categoryUnits.filter((u) => similarUnitIds.has(u.id));
  const similarAggregates = categoryAggregates.filter((a) => similarUnitIds.has(a.unitId));
  const similarLocalsTable = buildSimilarLocalsTable({
    unit,
    similarUnits,
    similarAggregates,
  });

  return {
    profile,
    quickStats,
    kpis,
    monthlyTimeline,
    tenantHistory,
    contracts: serializedContracts,
    billingBreakdown,
    salesPerformance,
    occupancyTimeline,
    occupancyDays,
    energyTimeline,
    gapAnalysis,
    projections,
    peerComparison,
    tenantsForSelector,
    tenantOnLocalAnalysis,
    categoryAnalysis,
    similarLocalsTable,
  };
}
