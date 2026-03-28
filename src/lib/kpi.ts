import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import {
  CONTRACT_EXPIRY_ROW_LIMIT as CONTRACT_EXPIRY_ROW_LIMIT_VALUE,
  CONTRACT_EXPIRY_WINDOWS as CONTRACT_EXPIRY_WINDOWS_VALUE
} from "@/lib/constants";

type DecimalLike = number | string | { toString(): string };

export const CONTRACT_EXPIRY_WINDOWS = CONTRACT_EXPIRY_WINDOWS_VALUE;
export type ExpiryWindow = (typeof CONTRACT_EXPIRY_WINDOWS_VALUE)[number];
export const CONTRACT_EXPIRY_ROW_LIMIT = CONTRACT_EXPIRY_ROW_LIMIT_VALUE;

export type KpiLocalInput = {
  id: string;
  codigo: string;
  esGLA: boolean;
  glam2: DecimalLike;
};

export type KpiTarifaInput = {
  tipo: TipoTarifaContrato;
  valor: DecimalLike;
};

export type KpiGgccInput = {
  tarifaBaseUfM2: DecimalLike;
  pctAdministracion: DecimalLike;
};

export type KpiContractInput = {
  id: string;
  localId: string;
  localCodigo: string;
  localEsGLA: boolean;
  localGlam2: DecimalLike;
  arrendatarioNombre: string;
  numeroContrato: string;
  fechaTermino: Date;
  tarifa: KpiTarifaInput | null;
  ggcc: KpiGgccInput | null;
};

export type ValorUfInput = {
  fecha: Date;
  valor: DecimalLike;
};

export type ContractStateCounter = {
  estado: EstadoContrato;
  cantidad: number;
  porcentaje: number;
};

export type ContractExpiryRow = {
  id: string;
  local: string;
  arrendatario: string;
  numeroContrato: string;
  fechaTermino: Date;
  diasRestantes: number;
};

export type ContractExpiryBuckets = Record<ExpiryWindow, ContractExpiryRow[]>;

const CONTRACT_STATES: EstadoContrato[] = [
  "VIGENTE",
  "GRACIA",
  "TERMINADO_ANTICIPADO",
  "TERMINADO"
];

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value: DecimalLike): number {
  return Number(value.toString());
}

function startOfDay(date: Date): Date {
  const output = new Date(date);
  output.setHours(0, 0, 0, 0);
  return output;
}

function addDays(date: Date, days: number): Date {
  const output = new Date(date);
  output.setDate(output.getDate() + days);
  return output;
}

/**
 * Formats a UF value with four decimal places.
 * @param value - UF value to format
 * @returns UF value as a fixed-decimal string or em dash when invalid
 */
export function formatUf(value: number | { toString(): string } | null | undefined): string {
  if (value === null || value === undefined) {
    return "\u2014";
  }
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isNaN(n) ? "\u2014" : n.toFixed(4);
}

/**
 * Formats a square-meter value for UI display.
 * @param value - Area value in square meters
 * @returns Localized square-meter string
 */
export function formatSquareMeters(value: number): string {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} m\u00b2`;
}

/**
 * Formats a percentage with one decimal place.
 * @param value - Percentage value
 * @returns Localized percentage string
 */
export function formatPercent(value: number): string {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

/**
 * Formats a numeric amount as Chilean pesos.
 * @param value - Monetary amount in CLP
 * @returns CLP-formatted currency string
 */
export function formatClp(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Formats a date in short Chilean format.
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getOccupiedLocalIds(activeLocales: KpiLocalInput[], contracts: KpiContractInput[]): Set<string> {
  const activeLocalIds = new Set(activeLocales.map((local) => local.id));
  return new Set(
    contracts.map((contract) => contract.localId).filter((localId) => activeLocalIds.has(localId))
  );
}

/**
 * Calculates occupancy metrics for active locales.
 * @param activeLocales - Active locales for the project
 * @param contracts - Active contracts used to determine occupied locales
 * @returns Occupancy totals and percentage
 * @remarks Formula: ocupados / totalActivos x 100
 */
export function calculateOccupancy(activeLocales: KpiLocalInput[], contracts: KpiContractInput[]): {
  totalActivos: number;
  ocupados: number;
  porcentaje: number;
} {
  const totalActivos = activeLocales.length;
  const ocupados = getOccupiedLocalIds(activeLocales, contracts).size;
  return {
    totalActivos,
    ocupados,
    porcentaje: totalActivos > 0 ? (ocupados / totalActivos) * 100 : 0
  };
}

/**
 * Calculates total and leased GLA for active locales.
 * @param activeLocales - Active locales for the project
 * @param contracts - Active contracts used to determine occupied locales
 * @returns Total GLA and leased GLA in square meters
 * @remarks Formula: suma(glam2) para locales GLA y suma(glam2) de locales GLA ocupados
 */
export function calculateGlaMetrics(activeLocales: KpiLocalInput[], contracts: KpiContractInput[]): {
  glaArrendada: number;
  glaTotal: number;
} {
  const occupiedLocalIds = getOccupiedLocalIds(activeLocales, contracts);

  const glaTotal = activeLocales
    .filter((local) => local.esGLA)
    .reduce((total, local) => total + toNumber(local.glam2), 0);

  const glaArrendada = activeLocales
    .filter((local) => local.esGLA && occupiedLocalIds.has(local.id))
    .reduce((total, local) => total + toNumber(local.glam2), 0);

  return { glaArrendada, glaTotal };
}

/**
 * Calculates vacancy metrics for active locales.
 * @param activeLocales - Active locales for the project
 * @param contracts - Active contracts used to determine occupied locales
 * @returns Total vacancies and first three vacant locale codes
 * @remarks Formula: totalVacantes = totalActivos - ocupados
 */
export function calculateVacancy(activeLocales: KpiLocalInput[], contracts: KpiContractInput[]): {
  totalVacantes: number;
  codigosPrimerosTres: string[];
} {
  const occupiedLocalIds = getOccupiedLocalIds(activeLocales, contracts);
  const vacantes = activeLocales.filter((local) => !occupiedLocalIds.has(local.id));

  return {
    totalVacantes: vacantes.length,
    codigosPrimerosTres: vacantes.slice(0, 3).map((local) => local.codigo)
  };
}

/**
 * Calculates estimated fixed monthly rent in UF.
 * @param contracts - Active contracts with current tariff data
 * @returns Total fixed rent in UF
 * @remarks Formula: FIJO_UF_M2 => valor x glam2; FIJO_UF => valor; PORCENTAJE no suma
 */
export function calculateFixedRentUf(contracts: KpiContractInput[]): number {
  return contracts.reduce((total, contract) => {
    if (!contract.tarifa) {
      return total;
    }

    const valorTarifa = toNumber(contract.tarifa.valor);
    if (contract.tarifa.tipo === TipoTarifaContrato.FIJO_UF_M2) {
      return total + valorTarifa * toNumber(contract.localGlam2);
    }
    if (contract.tarifa.tipo === TipoTarifaContrato.FIJO_UF) {
      return total + valorTarifa;
    }

    return total;
  }, 0);
}

/**
 * Builds a CLP metric card for fixed rent using the UF value.
 * @param rentaFijaUf - Total fixed rent in UF
 * @param valorUf - UF value record used for conversion
 * @returns Display-ready value and subtitle text
 * @remarks Formula: rentaFijaUf x valorUf
 */
export function buildFixedRentClpMetric(
  rentaFijaUf: number,
  valorUf: ValorUfInput | null
): { value: string; subtitle: string } {
  if (!valorUf) {
    return {
      value: "Sin valor UF",
      subtitle: "No hay valor UF registrado"
    };
  }

  const uf = toNumber(valorUf.valor);
  return {
    value: formatClp(rentaFijaUf * uf),
    subtitle: `UF al ${formatShortDate(valorUf.fecha)}: ${formatClp(uf)}`
  };
}

/**
 * Estimates the monthly GGCC cost in UF across active contracts.
 * @param contracts - Active contracts with GGCC configuration
 * @returns Total estimated monthly GGCC cost in UF
 * @remarks Formula: tarifaBaseUfM2 x glam2 x (1 + pctAdministracion / 100) por contrato
 */
export function calculateEstimatedGgccUf(contracts: KpiContractInput[]): number {
  return contracts.reduce((total, contract) => {
    if (!contract.ggcc) {
      return total;
    }

    const baseUfM2 = toNumber(contract.ggcc.tarifaBaseUfM2);
    const pctAdministracion = toNumber(contract.ggcc.pctAdministracion);
    const glam2 = toNumber(contract.localGlam2);
    const base = baseUfM2 * glam2;
    return total + base + (pctAdministracion / 100) * base;
  }, 0);
}

/**
 * Builds counters for each contract state with percentages.
 * @param rawCounts - Aggregated counts by contract state
 * @returns Total contracts and normalized state counters
 * @remarks Formula: porcentajeEstado = cantidadEstado / total x 100
 */
export function calculateContractStateCounters(
  rawCounts: Array<{ estado: EstadoContrato; cantidad: number }>
): { total: number; counters: ContractStateCounter[] } {
  const total = rawCounts.reduce((sum, item) => sum + item.cantidad, 0);
  const byState = new Map(rawCounts.map((item) => [item.estado, item.cantidad]));

  const counters = CONTRACT_STATES.map((estado) => {
    const cantidad = byState.get(estado) ?? 0;
    return {
      estado,
      cantidad,
      porcentaje: total > 0 ? (cantidad / total) * 100 : 0
    };
  });

  return { total, counters };
}

/**
 * Builds sorted contract-expiry rows for a specific window.
 * @param contracts - Contracts to evaluate
 * @param today - Reference date for window bounds
 * @param dias - Expiry window in days
 * @param limit - Maximum number of rows to return
 * @returns Sorted contract rows that expire within the window
 * @remarks Formula: diasRestantes = round((fechaTermino - hoy) / 86_400_000)
 */
export function buildContractExpiryRows(
  contracts: KpiContractInput[],
  today: Date,
  dias: ExpiryWindow,
  limit = CONTRACT_EXPIRY_ROW_LIMIT
): ContractExpiryRow[] {
  const start = startOfDay(today);
  const end = addDays(start, dias);

  return contracts
    .filter((contract) => {
      const endDate = startOfDay(contract.fechaTermino);
      return endDate >= start && endDate <= end;
    })
    .sort((a, b) => a.fechaTermino.getTime() - b.fechaTermino.getTime())
    .slice(0, limit)
    .map((contract) => {
      const diasRestantes = Math.round(
        (startOfDay(contract.fechaTermino).getTime() - start.getTime()) / DAY_MS
      );
      return {
        id: contract.id,
        local: contract.localCodigo,
        arrendatario: contract.arrendatarioNombre,
        numeroContrato: contract.numeroContrato,
        fechaTermino: contract.fechaTermino,
        diasRestantes
      };
    });
}

/**
 * Builds expiry buckets for all configured expiry windows.
 * @param contracts - Contracts to evaluate
 * @param today - Reference date for window bounds
 * @returns Expiry rows grouped by configured window
 * @remarks Formula: aplica buildContractExpiryRows para 30, 60 y 90 dias
 */
export function buildContractExpiryBuckets(
  contracts: KpiContractInput[],
  today: Date
): ContractExpiryBuckets {
  return {
    30: buildContractExpiryRows(contracts, today, 30),
    60: buildContractExpiryRows(contracts, today, 60),
    90: buildContractExpiryRows(contracts, today, 90)
  };
}

export type AlertCounts = {
  vencen30: number;
  vencen90: number;
  enGracia: number;
  vacantes: number;
  proyectoId: string;
};

type AlertContractInput = Pick<KpiContractInput, "fechaTermino"> & {
  estado: EstadoContrato;
};

/**
 * Builds top-level alert counters for the executive dashboard.
 * @param contratos - Active contracts that may trigger alerts
 * @param localesVacantes - Active locales without a current valid contract
 * @param hoy - Reference date for expiry windows
 * @returns Alert counters for 30-day, 31-90-day, grace and vacancy alerts
 */
export function buildAlertCounts(
  contratos: AlertContractInput[],
  localesVacantes: Array<Pick<KpiLocalInput, "id">>,
  hoy: Date,
  proyectoId: string
): AlertCounts {
  const start = startOfDay(hoy);
  const day30 = addDays(start, 30);
  const day31 = addDays(start, 31);
  const day90 = addDays(start, 90);

  return contratos.reduce<AlertCounts>(
    (acc, contrato) => {
      const endDate = startOfDay(contrato.fechaTermino);
      if (contrato.estado === EstadoContrato.GRACIA) {
        acc.enGracia += 1;
      }

      if (endDate >= start && endDate <= day30) {
        acc.vencen30 += 1;
      } else if (endDate >= day31 && endDate <= day90) {
        acc.vencen90 += 1;
      }

      return acc;
    },
    {
      vencen30: 0,
      vencen90: 0,
      enGracia: 0,
      vacantes: localesVacantes.length,
      proyectoId
    }
  );
}

/**
 * Builds monthly fixed-rent exposure for contracts expiring within a time window.
 * @param contratos - Contracts to evaluate for potential rent at risk
 * @param hoy - Reference date for the window start
 * @param diasVentana - Number of days in the risk window
 * @returns UF amount at risk and number of contracts in scope
 */
export function buildRentaEnRiesgo(
  contratos: KpiContractInput[],
  hoy: Date,
  diasVentana: number
): { ufEnRiesgo: number; count: number } {
  const start = startOfDay(hoy);
  const safeDiasVentana =
    Number.isFinite(diasVentana) && diasVentana >= 0 ? Math.floor(diasVentana) : 0;
  const end = addDays(start, safeDiasVentana);

  return contratos.reduce(
    (acc, contrato) => {
      const fechaTermino = startOfDay(contrato.fechaTermino);
      if (fechaTermino < start || fechaTermino > end) {
        return acc;
      }

      acc.count += 1;
      if (!contrato.tarifa) {
        return acc;
      }

      const valorTarifa = toNumber(contrato.tarifa.valor);
      if (contrato.tarifa.tipo === TipoTarifaContrato.FIJO_UF_M2) {
        acc.ufEnRiesgo += valorTarifa * toNumber(contrato.localGlam2);
      } else if (contrato.tarifa.tipo === TipoTarifaContrato.FIJO_UF) {
        acc.ufEnRiesgo += valorTarifa;
      }

      return acc;
    },
    { ufEnRiesgo: 0, count: 0 }
  );
}

/**
 * Estimates monthly potential rent loss for vacant locales.
 * @param localesVacantes - Vacant locales to evaluate
 * @param promedioTarifaProyecto - Weighted monthly fixed-rent average in UF/m2
 * @returns Estimated monthly UF lost in vacancies
 */
export function buildRentaPotencialVacantes(
  localesVacantes: Array<Pick<KpiLocalInput, "glam2">>,
  promedioTarifaProyecto: number
): number {
  if (promedioTarifaProyecto <= 0) {
    return 0;
  }

  return localesVacantes.reduce(
    (total, local) => total + toNumber(local.glam2) * promedioTarifaProyecto,
    0
  );
}
