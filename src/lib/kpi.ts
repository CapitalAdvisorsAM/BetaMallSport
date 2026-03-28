import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";

type DecimalLike = number | string | { toString(): string };

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

export type ContractExpiryBuckets = Record<30 | 60 | 90, ContractExpiryRow[]>;

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

export function formatUf(value: number): string {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} UF`;
}

export function formatSquareMeters(value: number): string {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} m\u00b2`;
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

export function formatClp(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

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

export function buildContractExpiryRows(
  contracts: KpiContractInput[],
  today: Date,
  dias: 30 | 60 | 90,
  limit = 10
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
