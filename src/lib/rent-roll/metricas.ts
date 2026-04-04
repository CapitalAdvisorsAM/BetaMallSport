import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import type { EstadoDiaContrato, Prisma } from "@prisma/client";
import { MS_PER_DAY } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { startOfUtcDay } from "@/lib/utils";
import type { RentRollMetricaRow, RentRollResumen } from "@/types/metricas";

type Decimal = Prisma.Decimal;

export type LocalActivo = {
  id: string;
  glam2: Decimal;
  esGLA: boolean;
};

export type MetricaRow = RentRollMetricaRow;

async function listContratosConRelaciones(
  proyectoId: string,
  start: Date,
  nextMonthStart: Date,
  hoy: Date
) {
  return prisma.contrato.findMany({
    where: {
      proyectoId,
      OR: [
        {
          contratosDia: {
            some: {
              fecha: { gte: start, lt: nextMonthStart },
              estadoDia: { in: ["OCUPADO", "GRACIA"] }
            }
          }
        },
        {
          estado: { in: [EstadoContrato.VIGENTE, EstadoContrato.GRACIA] },
          fechaInicio: { lt: nextMonthStart },
          fechaTermino: { gte: start }
        }
      ]
    },
    include: {
      contratosDia: {
        where: {
          fecha: { gte: start, lt: nextMonthStart }
        },
        select: {
          estadoDia: true
        }
      },
      local: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          glam2: true,
          esGLA: true,
          estado: true
        }
      },
      arrendatario: {
        select: {
          nombreComercial: true
        }
      },
      tarifas: {
        where: {
          tipo: { in: [TipoTarifaContrato.FIJO_UF_M2, TipoTarifaContrato.PORCENTAJE] },
          vigenciaDesde: { lte: hoy },
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: hoy } }]
        },
        orderBy: { vigenciaDesde: "desc" },
        select: {
          tipo: true,
          valor: true
        }
      },
      ggcc: {
        where: {
          vigenciaDesde: { lte: hoy }
        },
        orderBy: { vigenciaDesde: "desc" },
        take: 1
      }
    },
    orderBy: [{ local: { codigo: "asc" } }]
  });
}

export type ContratoConRelaciones = Awaited<ReturnType<typeof listContratosConRelaciones>>[number];

function round4(value: number): number {
  return Number(value.toFixed(4));
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

function getPeriodoBounds(periodoStr: string): { start: Date; nextMonthStart: Date } {
  const { year, month } = parsePeriodo(periodoStr);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    nextMonthStart: new Date(Date.UTC(year, month, 1))
  };
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
  tarifaVariablePct: Decimal | null
): number | null {
  if (ventasUf === null) {
    return null;
  }
  return round4(ventasUf * ((tarifaVariablePct?.toNumber() ?? 0) / 100));
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
  estado: EstadoDiaContrato,
  ventasMap: Map<string, number>,
  periodo: string
): RentRollMetricaRow {
  const tarifaFijaVigente =
    contrato.tarifas.find((tarifa) => tarifa.tipo === TipoTarifaContrato.FIJO_UF_M2)?.valor ?? null;
  const tarifaVariableVigente =
    contrato.tarifas.find((tarifa) => tarifa.tipo === TipoTarifaContrato.PORCENTAJE)?.valor ?? null;
  const ggccVigente = contrato.ggcc[0];
  const ventasUf = ventasMap.get(contrato.local.id) ?? null;

  const tarifaUfM2 = round4(tarifaFijaVigente?.toNumber() ?? 0);
  const rentaFijaUf = calcularRentaFija(contrato.local.glam2, tarifaFijaVigente);
  const ggccUf = calcularGgcc(
    contrato.local.glam2,
    ggccVigente?.tarifaBaseUfM2 ?? null,
    ggccVigente?.pctAdministracion ?? null
  );
  const rentaVariableUf = calcularRentaVariable(ventasUf, tarifaVariableVigente);
  const ingresoBrutoUf = round4(rentaFijaUf + ggccUf + (rentaVariableUf ?? 0));

  return {
    contratoId: contrato.id,
    localCodigo: contrato.local.codigo,
    localNombre: contrato.local.nombre,
    arrendatario: contrato.arrendatario.nombreComercial,
    estado,
    glam2: round4(contrato.local.glam2.toNumber()),
    tarifaUfM2,
    rentaFijaUf,
    ggccUf,
    ventasUf,
    rentaVariableUf,
    ingresoBrutoUf,
    fechaTermino: contrato.fechaTermino.toISOString().slice(0, 10),
    diasVigentes: calcularDiasVigentes(contrato.fechaInicio, contrato.fechaTermino, periodo)
  };
}

export function getEstadoContratoDia(estadosDia: EstadoDiaContrato[]): EstadoDiaContrato | null {
  if (estadosDia.includes("OCUPADO")) {
    return "OCUPADO";
  }
  if (estadosDia.includes("GRACIA")) {
    return "GRACIA";
  }
  if (estadosDia.includes("VACANTE")) {
    return "VACANTE";
  }
  return null;
}

function fallbackEstadoPorDocumento(estado: EstadoContrato): EstadoDiaContrato | null {
  if (estado === EstadoContrato.GRACIA) {
    return "GRACIA";
  }
  if (estado === EstadoContrato.VIGENTE) {
    return "OCUPADO";
  }
  return null;
}

export async function getMetricasRentRoll(
  proyectoId: string,
  periodo: string
): Promise<MetricaRow[]> {
  const hoy = new Date();
  const { start, nextMonthStart } = getPeriodoBounds(periodo);

  const [contratosConRelaciones, ventasPeriodo] = await Promise.all([
    listContratosConRelaciones(proyectoId, start, nextMonthStart, hoy),
    prisma.ventaLocal.findMany({
      where: { proyectoId, periodo },
      select: {
        localId: true,
        ventasUf: true
      }
    })
  ]);

  const ventasMap = new Map<string, number>(
    ventasPeriodo.map((venta) => [venta.localId, venta.ventasUf.toNumber()])
  );

  return contratosConRelaciones
    .map((contrato) => {
      const estadoPorDia = getEstadoContratoDia(
        contrato.contratosDia.map((estadoDia) => estadoDia.estadoDia)
      );
      const estadoContrato = estadoPorDia ?? fallbackEstadoPorDocumento(contrato.estado);
      if (!estadoContrato || estadoContrato === "VACANTE") {
        return null;
      }
      return buildMetricaRow(contrato, estadoContrato, ventasMap, periodo);
    })
    .filter((fila): fila is MetricaRow => fila !== null);
}

export function buildResumen(
  filas: RentRollMetricaRow[],
  todosLocales: LocalActivo[],
  hoy: Date
): RentRollResumen {
  const filasOcupadas = filas.filter(
    (fila) => fila.estado === "OCUPADO" || fila.estado === "GRACIA"
  );

  const glaTotal = sum(todosLocales.map((local) => local.glam2.toNumber()));
  const glaArrendada = sum(filasOcupadas.map((fila) => fila.glam2));
  const glaVacante = round4(glaTotal - glaArrendada);
  const tasaOcupacion = glaTotal > 0 ? round4((glaArrendada / glaTotal) * 100) : 0;

  const ventasDisponibles = filas
    .map((fila) => fila.ventasUf)
    .filter((value): value is number => value !== null);
  const rentaVariableDisponibles = filas
    .map((fila) => fila.rentaVariableUf)
    .filter((value): value is number => value !== null);

  const contratosPorVencer30 = filasOcupadas.filter((fila) => {
    const days = daysUntilDate(hoy, new Date(fila.fechaTermino));
    return days >= 0 && days <= 30;
  }).length;
  const contratosPorVencer60 = filasOcupadas.filter((fila) => {
    const days = daysUntilDate(hoy, new Date(fila.fechaTermino));
    return days >= 0 && days <= 60;
  }).length;
  const contratosPorVencer90 = filasOcupadas.filter((fila) => {
    const days = daysUntilDate(hoy, new Date(fila.fechaTermino));
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
    contratosVigentes: filasOcupadas.length,
    contratosPorVencer30,
    contratosPorVencer60,
    contratosPorVencer90
  };
}
