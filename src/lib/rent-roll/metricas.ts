import type { EstadoContrato, EstadoMaestro, Prisma } from "@prisma/client";
import type { RentRollMetricaRow, RentRollResumen } from "@/types/metricas";

type Decimal = Prisma.Decimal;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ContratoConRelaciones = {
  id: string;
  estado: EstadoContrato;
  fechaInicio: Date;
  fechaTermino: Date;
  pctRentaVariable: Decimal | null;
  local: {
    id: string;
    codigo: string;
    nombre: string;
    glam2: Decimal;
    esGLA: boolean;
    estado: EstadoMaestro;
  };
  arrendatario: {
    nombreComercial: string;
  };
  tarifas: Array<{
    valor: Decimal;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: Decimal;
    pctAdministracion: Decimal;
  }>;
};

export type LocalActivo = {
  id: string;
  glam2: Decimal;
  esGLA: boolean;
};

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parsePeriodo(periodoStr: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(periodoStr);
  if (!match) {
    throw new Error("Periodo invalido.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error("Periodo invalido.");
  }

  return { year, month };
}

function sum(values: number[]): number {
  return round4(values.reduce((acc, value) => acc + value, 0));
}

function daysUntilDate(from: Date, to: Date): number {
  return Math.floor((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY);
}

export function calcularRentaFija(glam2: Decimal, tarifa: Decimal | null): number {
  return round4(glam2.toNumber() * (tarifa?.toNumber() ?? 0));
}

export function calcularGgcc(
  glam2: Decimal,
  tarifaBase: Decimal | null,
  pctAdm: Decimal | null
): number {
  const tarifaBaseValue = tarifaBase?.toNumber() ?? 0;
  const pctAdmValue = pctAdm?.toNumber() ?? 0;
  return round4(tarifaBaseValue * glam2.toNumber() * (1 + pctAdmValue / 100));
}

export function calcularRentaVariable(
  ventasUf: number | null,
  pctRentaVariable: Decimal | null
): number | null {
  if (ventasUf === null) {
    return null;
  }
  return round4(ventasUf * ((pctRentaVariable?.toNumber() ?? 0) / 100));
}

export function calcularDiasVigentes(
  fechaInicio: Date,
  fechaTermino: Date,
  periodoStr: string
): number {
  const { year, month } = parsePeriodo(periodoStr);
  const periodoInicio = new Date(Date.UTC(year, month - 1, 1));
  const periodoFin = new Date(Date.UTC(year, month, 0));

  const inicioContrato = startOfUtcDay(fechaInicio);
  const finContrato = startOfUtcDay(fechaTermino);

  const inicio = new Date(Math.max(inicioContrato.getTime(), periodoInicio.getTime()));
  const fin = new Date(Math.min(finContrato.getTime(), periodoFin.getTime()));

  if (inicio.getTime() > fin.getTime()) {
    return 0;
  }

  return Math.floor((fin.getTime() - inicio.getTime()) / MS_PER_DAY) + 1;
}

export function buildMetricaRow(
  contrato: ContratoConRelaciones,
  ventasMap: Map<string, number>,
  periodo: string
): RentRollMetricaRow {
  const tarifaVigente = contrato.tarifas[0]?.valor ?? null;
  const ggccVigente = contrato.ggcc[0];
  const ventasUf = ventasMap.get(contrato.local.id) ?? null;

  const tarifaUfM2 = round4(tarifaVigente?.toNumber() ?? 0);
  const rentaFijaUf = calcularRentaFija(contrato.local.glam2, tarifaVigente);
  const ggccUf = calcularGgcc(
    contrato.local.glam2,
    ggccVigente?.tarifaBaseUfM2 ?? null,
    ggccVigente?.pctAdministracion ?? null
  );
  const rentaVariableUf = calcularRentaVariable(ventasUf, contrato.pctRentaVariable);
  const ingresoBrutoUf = round4(rentaFijaUf + ggccUf + (rentaVariableUf ?? 0));

  return {
    contratoId: contrato.id,
    localCodigo: contrato.local.codigo,
    localNombre: contrato.local.nombre,
    arrendatario: contrato.arrendatario.nombreComercial,
    estado: contrato.estado,
    glam2: round4(contrato.local.glam2.toNumber()),
    tarifaUfM2,
    rentaFijaUf,
    ggccUf,
    ventasUf,
    rentaVariableUf,
    ingresoBrutoUf,
    fechaTermino: contrato.fechaTermino,
    diasVigentes: calcularDiasVigentes(contrato.fechaInicio, contrato.fechaTermino, periodo)
  };
}

export function buildResumen(
  filas: RentRollMetricaRow[],
  todosLocales: LocalActivo[],
  hoy: Date
): RentRollResumen {
  const filasVigentes = filas.filter((fila) => fila.estado === "VIGENTE");

  const glaTotal = sum(todosLocales.map((local) => local.glam2.toNumber()));
  const glaArrendada = sum(filasVigentes.map((fila) => fila.glam2));
  const glaVacante = round4(glaTotal - glaArrendada);
  const tasaOcupacion = glaTotal > 0 ? round4((glaArrendada / glaTotal) * 100) : 0;

  const ventasDisponibles = filas
    .map((fila) => fila.ventasUf)
    .filter((value): value is number => value !== null);
  const rentaVariableDisponibles = filas
    .map((fila) => fila.rentaVariableUf)
    .filter((value): value is number => value !== null);

  const contratosPorVencer30 = filasVigentes.filter((fila) => {
    const days = daysUntilDate(hoy, fila.fechaTermino);
    return days >= 0 && days <= 30;
  }).length;
  const contratosPorVencer60 = filasVigentes.filter((fila) => {
    const days = daysUntilDate(hoy, fila.fechaTermino);
    return days >= 0 && days <= 60;
  }).length;
  const contratosPorVencer90 = filasVigentes.filter((fila) => {
    const days = daysUntilDate(hoy, fila.fechaTermino);
    return days >= 0 && days <= 90;
  }).length;

  return {
    glaTotal,
    glaArrendada,
    glaVacante,
    tasaOcupacion,
    rentaFijaTotalUf: sum(filas.map((fila) => fila.rentaFijaUf)),
    ggccTotalUf: sum(filas.map((fila) => fila.ggccUf)),
    ventasTotalUf: ventasDisponibles.length > 0 ? sum(ventasDisponibles) : null,
    rentaVariableTotalUf:
      rentaVariableDisponibles.length > 0 ? sum(rentaVariableDisponibles) : null,
    ingresoBrutoTotalUf: sum(filas.map((fila) => fila.ingresoBrutoUf)),
    contratosVigentes: filasVigentes.length,
    contratosPorVencer30,
    contratosPorVencer60,
    contratosPorVencer90
  };
}
