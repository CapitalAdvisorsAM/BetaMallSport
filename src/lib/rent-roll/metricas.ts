import { ContractStatus, ContractRateType } from "@prisma/client";
import type { ContractDayStatus, Prisma } from "@prisma/client";
import { MS_PER_DAY, VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { shiftPeriod } from "@/lib/finance/billing-utils";
import { prisma } from "@/lib/prisma";
import { startOfUtcDay } from "@/lib/utils";
import type { RentRollMetricRow, RentRollSummary } from "@/types/metrics";

type Decimal = Prisma.Decimal;

export type LocalActivo = {
  id: string;
  glam2: Decimal;
  esGLA: boolean;
};

export type MetricaRow = RentRollMetricRow;

async function listContratosConRelaciones(
  proyectoId: string,
  start: Date,
  nextMonthStart: Date,
  hoy: Date
) {
  return prisma.contract.findMany({
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
          estado: { not: ContractStatus.TERMINADO_ANTICIPADO },
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
          tipo: { in: [ContractRateType.FIJO_UF_M2, ContractRateType.PORCENTAJE] },
          vigenciaDesde: { lte: hoy },
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: hoy } }]
        },
        orderBy: { vigenciaDesde: "desc" },
        select: {
          tipo: true,
          valor: true,
          umbralVentasUf: true
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
  tarifaVariablePct: Decimal | null,
  rentaFijaUf: number = 0,
  tiers?: Array<{ umbralVentasUf: number; pct: number }>
): number | null {
  if (ventasUf === null) {
    return null;
  }
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => b.umbralVentasUf - a.umbralVentasUf);
    const tier = sorted.find((t) => ventasUf >= t.umbralVentasUf);
    if (!tier) return 0;
    return round4(Math.max(0, ventasUf * (tier.pct / 100) - rentaFijaUf));
  }
  return round4(Math.max(0, ventasUf * ((tarifaVariablePct?.toNumber() ?? 0) / 100) - rentaFijaUf));
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
  estado: ContractDayStatus,
  ventasMap: Map<string, number>,
  periodo: string
): RentRollMetricRow {
  const tarifaFijaVigente =
    contrato.tarifas.find((tarifa) => tarifa.tipo === ContractRateType.FIJO_UF_M2)?.valor ?? null;
  const tarifasVariable = contrato.tarifas.filter((tarifa) => tarifa.tipo === ContractRateType.PORCENTAJE);
  const ggccVigente = contrato.ggcc[0];
  const ventasUf = ventasMap.get(contrato.arrendatarioId) ?? null;

  const tarifaUfM2 = round4(tarifaFijaVigente?.toNumber() ?? 0);
  const rentaFijaUf = calcularRentaFija(contrato.local.glam2, tarifaFijaVigente);
  const ggccUf = calcularGgcc(
    contrato.local.glam2,
    ggccVigente?.tarifaBaseUfM2 ?? null,
    ggccVigente?.pctAdministracion ?? null
  );
  const variableTiers = tarifasVariable.map((t) => ({
    umbralVentasUf: Number(t.umbralVentasUf?.toString() ?? "0"),
    pct: Number(t.valor.toString()),
  }));
  const rentaVariableUf = calcularRentaVariable(ventasUf, tarifasVariable[0]?.valor ?? null, rentaFijaUf, variableTiers);
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

export function getEstadoContratoDia(estadosDia: ContractDayStatus[]): ContractDayStatus | null {
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

function fallbackEstadoPorDocumento(estado: ContractStatus): ContractDayStatus | null {
  if (estado === ContractStatus.GRACIA) {
    return "GRACIA";
  }
  if (estado === ContractStatus.VIGENTE) {
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

  const prevPeriodo = shiftPeriod(periodo, -VARIABLE_RENT_LAG_MONTHS);

  const contratosConRelaciones = await listContratosConRelaciones(proyectoId, start, nextMonthStart, hoy);

  const tenantIds = [...new Set(contratosConRelaciones.map((c) => c.arrendatarioId))];

  const ventasPeriodo = tenantIds.length > 0
    ? await prisma.tenantSale.findMany({
        where: { projectId: proyectoId, tenantId: { in: tenantIds }, period: new Date(`${prevPeriodo}-01`) },
        select: {
          tenantId: true,
          salesUf: true
        }
      })
    : [];

  const ventasMap = new Map<string, number>(
    ventasPeriodo.map((venta) => [venta.tenantId, venta.salesUf.toNumber()])
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
  filas: RentRollMetricRow[],
  todosLocales: LocalActivo[],
  hoy: Date
): RentRollSummary {
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

