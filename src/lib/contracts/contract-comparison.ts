import {
  AccountingScenario,
  ContractDiscountType,
  ContractRateType,
  ContractStatus,
  type PrismaClient,
  type UnitType,
} from "@prisma/client";
import { MS_PER_DAY, VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  calcExpectedIncome,
  computeEffectiveRate,
  findGgccForPeriod,
  findRateForPeriod,
  shiftPeriod,
  toNum,
  type DecimalLike,
  type GgccEntry,
  type RateEntry,
} from "@/lib/real/billing-utils";
import { buildUfRateMap, getUfRate } from "@/lib/real/uf-lookup";
import type {
  ContractComparison,
  ContractComparisonMatchLevel,
  ContractComparisonMetric,
  ContractComparisonRow,
} from "@/types/contract-comparison";

const MIN_STRICT_PEERS = 2;

type ComparisonLocal = {
  id: string;
  codigo: string;
  nombre: string;
  glam2: DecimalLike;
  piso: string | null;
  tipo: UnitType;
  zonaId: string | null;
  categoriaTamano: string | null;
};

export type ComparisonContractInput = {
  id: string;
  numeroContrato: string;
  localId: string;
  arrendatarioId: string;
  arrendatario: { nombreComercial: string; razonSocial?: string | null };
  local: ComparisonLocal;
  estado: ContractStatus;
  fechaInicio: Date;
  fechaTermino: Date;
  pctFondoPromocion: DecimalLike | null;
  multiplicadorDiciembre: DecimalLike | null;
  multiplicadorJunio: DecimalLike | null;
  multiplicadorJulio: DecimalLike | null;
  multiplicadorAgosto: DecimalLike | null;
  tarifas: RateEntry[];
  ggcc: Array<GgccEntry & { pctAdministracion?: DecimalLike | null }>;
};

export type ComparisonAccountingRecord = {
  unitId: string | null;
  tenantId: string | null;
  period: Date;
  group1: string;
  valueUf: DecimalLike;
};

export type ComparisonSaleRecord = {
  tenantId: string;
  period: Date;
  salesPesos: DecimalLike;
};

type BuildContractComparisonInput = {
  target: ComparisonContractInput;
  candidates: ComparisonContractInput[];
  accountingRecords: ComparisonAccountingRecord[];
  salesRecords: ComparisonSaleRecord[];
  ufRateByPeriod: Map<string, number>;
  desdeDate: Date;
  hastaDate: Date;
  today?: Date;
};

type DbClient = Pick<
  PrismaClient,
  "contract" | "accountingRecord" | "tenantSale"
>;

function monthPeriods(desdeDate: Date, hastaDate: Date): string[] {
  const periods: string[] = [];
  let cursor = new Date(Date.UTC(desdeDate.getUTCFullYear(), desdeDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(hastaDate.getUTCFullYear(), hastaDate.getUTCMonth(), 1));
  while (cursor <= end) {
    periods.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return periods;
}

function periodDate(period: string): Date {
  return new Date(`${period}-01T00:00:00.000Z`);
}

function periodOverlapsContract(period: string, contract: Pick<ComparisonContractInput, "fechaInicio" | "fechaTermino">): boolean {
  const start = periodDate(period);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return contract.fechaInicio <= end && contract.fechaTermino >= start;
}

function daysRemaining(fechaTermino: Date, today: Date): number {
  return Math.max(
    0,
    Math.round((fechaTermino.getTime() - today.getTime()) / MS_PER_DAY),
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricSummary(
  current: ContractComparisonRow,
  peers: ContractComparisonRow[],
  selector: (row: ContractComparisonRow) => number | null,
  rankDirection: "asc" | "desc" = "desc",
): ContractComparisonMetric {
  const currentValue = selector(current);
  const peerValues = peers
    .map(selector)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const peerAverage = average(peerValues);
  const allRows = [current, ...peers]
    .map((row) => ({ row, value: selector(row) }))
    .filter((item): item is { row: ContractComparisonRow; value: number } =>
      item.value !== null && Number.isFinite(item.value)
    )
    .sort((a, b) => rankDirection === "desc" ? b.value - a.value : a.value - b.value);
  const rankIndex = allRows.findIndex((item) => item.row.contractId === current.contractId);
  return {
    current: currentValue,
    peerAverage,
    peerMedian: median(peerValues),
    deltaVsAverage:
      currentValue !== null && peerAverage !== null ? currentValue - peerAverage : null,
    rankPosition: rankIndex >= 0 ? rankIndex + 1 : null,
    rankTotal: allRows.length,
  };
}

function currentRates(contract: ComparisonContractInput, referenceDate: Date): RateEntry[] {
  const active = contract.tarifas.filter(
    (rate) =>
      rate.vigenciaDesde <= referenceDate &&
      (!rate.vigenciaHasta || rate.vigenciaHasta >= referenceDate),
  );
  if (active.length > 0) return active;

  const latestStart = contract.tarifas
    .filter((rate) => rate.vigenciaDesde <= referenceDate)
    .sort((a, b) => b.vigenciaDesde.getTime() - a.vigenciaDesde.getTime())[0]?.vigenciaDesde;
  if (!latestStart) return [];
  return contract.tarifas.filter(
    (rate) => rate.vigenciaDesde.getTime() === latestStart.getTime(),
  );
}

function discountLabel(rate: RateEntry | null): string | null {
  if (!rate?.descuentoTipo || rate.descuentoValor === null || rate.descuentoValor === undefined) {
    return null;
  }
  const value = toNum(rate.descuentoValor);
  if (rate.descuentoTipo === ContractDiscountType.PORCENTAJE) {
    return `${(value * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
  }
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 2 })} UF`;
}

function buildRow(input: {
  contract: ComparisonContractInput;
  accountingRecords: ComparisonAccountingRecord[];
  salesUfByTenantPeriod: Map<string, Map<string, number>>;
  periods: string[];
  today: Date;
}): ContractComparisonRow {
  const { contract, accountingRecords, salesUfByTenantPeriod, periods, today } = input;
  const glam2 = toNum(contract.local.glam2);
  const referenceDate = today;
  const rates = currentRates(contract, referenceDate);
  const fixedRate =
    rates.find((rate) => rate.tipo === ContractRateType.FIJO_UF_M2 || rate.tipo === ContractRateType.FIJO_UF) ??
    findRateForPeriod(contract.tarifas, referenceDate);
  const fixedRateValue = fixedRate ? computeEffectiveRate(fixedRate, referenceDate) : null;
  const fixedRentUf = fixedRate && fixedRateValue !== null
    ? fixedRate.tipo === ContractRateType.FIJO_UF_M2
      ? fixedRateValue * glam2
      : fixedRate.tipo === ContractRateType.FIJO_UF
        ? fixedRateValue
        : null
    : null;

  const variableRates = rates.filter((rate) => rate.tipo === ContractRateType.PORCENTAJE);
  const variablePct =
    variableRates.length > 0 ? Math.max(...variableRates.map((rate) => toNum(rate.valor))) : null;
  const pisoMinimoValues = variableRates
    .map((rate) => rate.pisoMinimoUf)
    .filter((value): value is DecimalLike => value !== null && value !== undefined)
    .map(toNum);
  const pisoMinimoUf = pisoMinimoValues.length > 0 ? Math.max(...pisoMinimoValues) : null;
  const discountedRate = rates.find((rate) => rate.descuentoTipo);

  const ggcc = findGgccForPeriod(contract.ggcc, referenceDate);
  const ggccUf = ggcc ? toNum(ggcc.tarifaBaseUfM2) * glam2 * (1 + toNum(ggcc.pctAdministracion) / 100) : null;

  const activePeriods = periods.filter((period) => periodOverlapsContract(period, contract));
  const activePeriodSet = new Set(activePeriods);
  const billingUf = accountingRecords
    .filter((record) => {
      if (record.group1 !== "INGRESOS DE EXPLOTACION") return false;
      if (!activePeriodSet.has(record.period.toISOString().slice(0, 7))) return false;
      if (record.unitId !== contract.localId) return false;
      return record.tenantId === null || record.tenantId === contract.arrendatarioId;
    })
    .reduce((sum, record) => sum + toNum(record.valueUf), 0);

  const tenantSales = salesUfByTenantPeriod.get(contract.arrendatarioId) ?? new Map<string, number>();
  const salesUf = activePeriods.reduce((sum, period) => sum + (tenantSales.get(period) ?? 0), 0);

  const expectedUf = activePeriods.reduce((sum, period) => {
    const date = periodDate(period);
    const lagPeriod = shiftPeriod(period, -VARIABLE_RENT_LAG_MONTHS);
    const expected = calcExpectedIncome({
      tarifas: contract.tarifas,
      ggcc: contract.ggcc,
      glam2,
      multiplicadorDiciembre: contract.multiplicadorDiciembre !== null ? toNum(contract.multiplicadorDiciembre) : null,
      multiplicadorJunio: contract.multiplicadorJunio !== null ? toNum(contract.multiplicadorJunio) : null,
      multiplicadorJulio: contract.multiplicadorJulio !== null ? toNum(contract.multiplicadorJulio) : null,
      multiplicadorAgosto: contract.multiplicadorAgosto !== null ? toNum(contract.multiplicadorAgosto) : null,
      pctFondoPromocion: contract.pctFondoPromocion !== null ? toNum(contract.pctFondoPromocion) : null,
      periodDate: date,
      salesUf: tenantSales.get(lagPeriod) ?? 0,
      estado: contract.estado,
    });
    return sum + expected.totalUf;
  }, 0);

  const denominatorMonths = activePeriods.length;
  const avgBillingUfM2 = denominatorMonths > 0 && glam2 > 0 ? (billingUf / denominatorMonths) / glam2 : null;
  const avgSalesUfM2 = denominatorMonths > 0 && glam2 > 0 ? (salesUf / denominatorMonths) / glam2 : null;
  const occupancyCostPct = salesUf > 0 ? (billingUf / salesUf) * 100 : null;
  const gapUf = expectedUf - billingUf;

  return {
    contractId: contract.id,
    numeroContrato: contract.numeroContrato,
    arrendatario: contract.arrendatario.nombreComercial || contract.arrendatario.razonSocial || "Sin arrendatario",
    localCodigo: contract.local.codigo,
    localNombre: contract.local.nombre,
    localGlam2: glam2,
    fixedRentUf,
    fixedRentUfM2: fixedRentUf !== null && glam2 > 0 ? fixedRentUf / glam2 : null,
    ggccUf,
    ggccUfM2: ggccUf !== null && glam2 > 0 ? ggccUf / glam2 : null,
    variablePct,
    pisoMinimoUf,
    pctFondoPromocion: contract.pctFondoPromocion !== null ? toNum(contract.pctFondoPromocion) : null,
    discountLabel: discountLabel(discountedRate ?? null),
    avgBillingUfM2,
    avgSalesUfM2,
    occupancyCostPct,
    gapPct: expectedUf > 0 ? (gapUf / expectedUf) * 100 : null,
    diasRestantes: daysRemaining(contract.fechaTermino, today),
  };
}

function sameCategory(a: ComparisonLocal, b: ComparisonLocal): boolean {
  return a.tipo === b.tipo && a.categoriaTamano === b.categoriaTamano;
}

function pickCohort(
  target: ComparisonContractInput,
  candidates: ComparisonContractInput[],
): { peers: ComparisonContractInput[]; matchLevel: ContractComparisonMatchLevel; cohortLabel: string } {
  const strict = candidates.filter(
    (contract) =>
      sameCategory(target.local, contract.local) &&
      contract.local.piso === target.local.piso,
  );
  if (strict.length >= MIN_STRICT_PEERS) {
    return { peers: strict, matchLevel: "strict", cohortLabel: "Mismo tipo, tamano y piso" };
  }

  const zone = candidates.filter(
    (contract) =>
      sameCategory(target.local, contract.local) &&
      target.local.zonaId !== null &&
      contract.local.zonaId === target.local.zonaId,
  );
  if (zone.length >= MIN_STRICT_PEERS) {
    return { peers: zone, matchLevel: "zone", cohortLabel: "Mismo tipo, tamano y zona" };
  }

  const category = candidates.filter((contract) => sameCategory(target.local, contract.local));
  if (category.length > 0) {
    return { peers: category, matchLevel: "category", cohortLabel: "Mismo tipo y tamano" };
  }

  return { peers: [], matchLevel: "none", cohortLabel: "Sin pares similares" };
}

export function buildContractComparison(input: BuildContractComparisonInput): ContractComparison {
  const today = input.today ?? new Date();
  const periods = monthPeriods(input.desdeDate, input.hastaDate);
  const { peers, matchLevel, cohortLabel } = pickCohort(input.target, input.candidates);

  const salesUfByTenantPeriod = new Map<string, Map<string, number>>();
  for (const sale of input.salesRecords) {
    const period = sale.period.toISOString().slice(0, 7);
    const ufRate = getUfRate(period, input.ufRateByPeriod);
    const salesUf = ufRate > 0 ? toNum(sale.salesPesos) / ufRate : 0;
    const tenantMap = salesUfByTenantPeriod.get(sale.tenantId) ?? new Map<string, number>();
    tenantMap.set(period, (tenantMap.get(period) ?? 0) + salesUf);
    salesUfByTenantPeriod.set(sale.tenantId, tenantMap);
  }

  const current = buildRow({
    contract: input.target,
    accountingRecords: input.accountingRecords,
    salesUfByTenantPeriod,
    periods,
    today,
  });
  const peerRows = peers
    .map((contract) =>
      buildRow({
        contract,
        accountingRecords: input.accountingRecords,
        salesUfByTenantPeriod,
        periods,
        today,
      }),
    )
    .sort((a, b) => (b.fixedRentUfM2 ?? -Infinity) - (a.fixedRentUfM2 ?? -Infinity));

  return {
    contractId: input.target.id,
    cohortLabel,
    matchLevel,
    peerCount: peerRows.length,
    current,
    metrics: {
      fixedRentUfM2: metricSummary(current, peerRows, (row) => row.fixedRentUfM2),
      ggccUfM2: metricSummary(current, peerRows, (row) => row.ggccUfM2),
      variablePct: metricSummary(current, peerRows, (row) => row.variablePct),
      pisoMinimoUf: metricSummary(current, peerRows, (row) => row.pisoMinimoUf),
      avgBillingUfM2: metricSummary(current, peerRows, (row) => row.avgBillingUfM2),
      avgSalesUfM2: metricSummary(current, peerRows, (row) => row.avgSalesUfM2),
      occupancyCostPct: metricSummary(current, peerRows, (row) => row.occupancyCostPct, "asc"),
      gapPct: metricSummary(current, peerRows, (row) => row.gapPct, "asc"),
      diasRestantes: metricSummary(current, peerRows, (row) => row.diasRestantes),
    },
    peers: peerRows,
  };
}

function projectDiscountFields<T extends { discounts: Array<{ tipo: ContractDiscountType; valor: DecimalLike; vigenciaDesde: Date; vigenciaHasta: Date | null }> }>(
  rate: T,
): Omit<T, "discounts"> & {
  descuentoTipo: ContractDiscountType | null;
  descuentoValor: DecimalLike | null;
  descuentoDesde: Date | null;
  descuentoHasta: Date | null;
} {
  const { discounts, ...rest } = rate;
  const discount = [...discounts].sort((a, b) => a.vigenciaDesde.getTime() - b.vigenciaDesde.getTime())[0];
  return {
    ...rest,
    descuentoTipo: discount?.tipo ?? null,
    descuentoValor: discount?.valor ?? null,
    descuentoDesde: discount?.vigenciaDesde ?? null,
    descuentoHasta: discount?.vigenciaHasta ?? null,
  };
}

export async function loadContractComparison(input: {
  projectId: string;
  contractId: string;
  desdeDate: Date;
  hastaDate: Date;
  client?: DbClient;
}): Promise<ContractComparison | null> {
  const client = input.client ?? prisma;
  const target = await client.contract.findFirst({
    where: { id: input.contractId, projectId: input.projectId },
    include: {
      arrendatario: { select: { nombreComercial: true, razonSocial: true } },
      local: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          glam2: true,
          piso: true,
          tipo: true,
          zonaId: true,
          categoriaTamano: true,
        },
      },
      tarifas: {
        where: { supersededAt: null },
        include: {
          discounts: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "asc" } },
        },
        orderBy: { vigenciaDesde: "desc" },
      },
      ggcc: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "desc" } },
    },
  });
  if (!target) return null;

  const candidates = await client.contract.findMany({
    where: {
      projectId: input.projectId,
      id: { not: input.contractId },
      estado: { in: [ContractStatus.VIGENTE, ContractStatus.GRACIA] },
      local: { tipo: target.local.tipo },
    },
    include: {
      arrendatario: { select: { nombreComercial: true, razonSocial: true } },
      local: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          glam2: true,
          piso: true,
          tipo: true,
          zonaId: true,
          categoriaTamano: true,
        },
      },
      tarifas: {
        where: { supersededAt: null },
        include: {
          discounts: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "asc" } },
        },
        orderBy: { vigenciaDesde: "desc" },
      },
      ggcc: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "desc" } },
    },
  });

  const contracts = [target, ...candidates].map((contract) => ({
    ...contract,
    tarifas: contract.tarifas.map(projectDiscountFields),
  }));
  const unitIds = [...new Set(contracts.map((contract) => contract.localId))];
  const tenantIds = [...new Set(contracts.map((contract) => contract.arrendatarioId))];
  const periods = monthPeriods(input.desdeDate, input.hastaDate);
  const lagPeriods = periods.map((period) => shiftPeriod(period, -VARIABLE_RENT_LAG_MONTHS));

  const [accountingRecords, salesRecords, ufRateByPeriod] = await Promise.all([
    client.accountingRecord.findMany({
      where: {
        projectId: input.projectId,
        scenario: AccountingScenario.REAL,
        period: { gte: input.desdeDate, lte: input.hastaDate },
        OR: [{ unitId: { in: unitIds } }, { tenantId: { in: tenantIds } }],
      },
      select: {
        unitId: true,
        tenantId: true,
        period: true,
        group1: true,
        valueUf: true,
      },
    }),
    client.tenantSale.findMany({
      where: {
        projectId: input.projectId,
        tenantId: { in: tenantIds },
        period: {
          gte: new Date(Date.UTC(input.desdeDate.getUTCFullYear(), input.desdeDate.getUTCMonth() - VARIABLE_RENT_LAG_MONTHS, 1)),
          lte: input.hastaDate,
        },
      },
      select: {
        tenantId: true,
        period: true,
        salesPesos: true,
      },
    }),
    buildUfRateMap([...new Set([...periods, ...lagPeriods])]),
  ]);

  return buildContractComparison({
    target: contracts[0] as ComparisonContractInput,
    candidates: contracts.slice(1) as ComparisonContractInput[],
    accountingRecords,
    salesRecords,
    ufRateByPeriod,
    desdeDate: input.desdeDate,
    hastaDate: input.hastaDate,
  });
}
