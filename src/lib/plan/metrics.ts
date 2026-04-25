import { ContractStatus, ContractRateType } from "@prisma/client";
import type { ContractDayStatus, Prisma } from "@prisma/client";
import { MS_PER_DAY, VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { shiftPeriod } from "@/lib/real/billing-utils";
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
      projectId: proyectoId,
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
          supersededAt: null,
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
          supersededAt: null,
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

export function daysUntilDate(from: Date, to: Date): number {
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
  ventasPesos: number | null,
  tarifaVariablePct: Decimal | null,
  rentaFijaUf: number = 0,
  tiers?: Array<{ umbralVentasUf: number; pct: number }>,
  ufRate = 0
): number | null {
  if (ventasPesos === null) {
    return null;
  }
  // Convert pesos → UF for threshold comparison and variable-rent calculation.
  const ventasUf = ufRate > 0 ? ventasPesos / ufRate : 0;
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
  periodo: string,
  ufRate = 0
): RentRollMetricRow {
  const tarifaFijaVigente =
    contrato.tarifas.find((tarifa) => tarifa.tipo === ContractRateType.FIJO_UF_M2)?.valor ?? null;
  const tarifasVariable = contrato.tarifas.filter((tarifa) => tarifa.tipo === ContractRateType.PORCENTAJE);
  const ggccVigente = contrato.ggcc[0];
  const ventasPesos = ventasMap.get(contrato.arrendatarioId) ?? null;

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
  const rentaVariableUf = calcularRentaVariable(ventasPesos, tarifasVariable[0]?.valor ?? null, rentaFijaUf, variableTiers, ufRate);
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
    ventasPesos,
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

  const [prevYear, prevMonth] = prevPeriodo.split("-").map(Number) as [number, number];
  const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(prevYear, prevMonth, 1));

  const [ventasPeriodo, ufForPeriod] = await Promise.all([
    tenantIds.length > 0
      ? prisma.tenantSale.findMany({
          where: { projectId: proyectoId, tenantId: { in: tenantIds }, period: new Date(`${prevPeriodo}-01`) },
          select: { tenantId: true, salesPesos: true }
        })
      : Promise.resolve([]),
    prisma.valorUF.findFirst({
      where: { fecha: { gte: prevMonthStart, lt: prevMonthEnd } },
      orderBy: { fecha: "asc" },
      select: { valor: true },
    }).then((uf) =>
      uf
        ? uf
        : prisma.valorUF.findFirst({
            where: { fecha: { lt: prevMonthStart } },
            orderBy: { fecha: "desc" },
            select: { valor: true },
          })
    ),
  ]);

  const ufRate = ufForPeriod ? Number(ufForPeriod.valor.toString()) : 0;

  const ventasMap = new Map<string, number>(
    ventasPeriodo.map((venta) => [venta.tenantId, venta.salesPesos.toNumber()])
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
      return buildMetricaRow(contrato, estadoContrato, ventasMap, periodo, ufRate);
    })
    .filter((fila): fila is MetricaRow => fila !== null);
}

export function buildResumen(
  filas: RentRollMetricRow[],
  todosLocales: LocalActivo[],
  hoy: Date
): RentRollSummary {
  const filasResumen = dedupeRowsByLocal(filas);
  const filasOcupadas = filasResumen.filter(
    (fila) => fila.estado === "OCUPADO" || fila.estado === "GRACIA"
  );

  const glaTotal = sum(todosLocales.map((local) => local.glam2.toNumber()));
  const glaArrendada = sum(filasOcupadas.map((fila) => fila.glam2));
  const glaVacante = round4(glaTotal - glaArrendada);
  const tasaOcupacion = glaTotal > 0 ? round4((glaArrendada / glaTotal) * 100) : 0;

  const ventasDisponibles = filasResumen
    .map((fila) => fila.ventasPesos)
    .filter((value): value is number => value !== null);
  const rentaVariableDisponibles = filasResumen
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
    rentaFijaTotalUf: sum(filasResumen.map((fila) => fila.rentaFijaUf)),
    ggccTotalUf: sum(filasResumen.map((fila) => fila.ggccUf)),
    ventasTotalPesos: ventasDisponibles.length > 0 ? sum(ventasDisponibles) : null,
    rentaVariableTotalUf:
      rentaVariableDisponibles.length > 0 ? sum(rentaVariableDisponibles) : null,
    ingresoBrutoTotalUf: sum(filasResumen.map((fila) => fila.ingresoBrutoUf)),
    contratosVigentes: filasOcupadas.length,
    contratosPorVencer30,
    contratosPorVencer60,
    contratosPorVencer90
  };
}

function dedupeRowsByLocal(filas: RentRollMetricRow[]): RentRollMetricRow[] {
  const deduped = new Map<string, RentRollMetricRow>();
  for (const fila of filas) {
    const current = deduped.get(fila.localCodigo);
    if (!current || compareRowsForResumen(fila, current) < 0) {
      deduped.set(fila.localCodigo, fila);
    }
  }
  return [...deduped.values()];
}

function compareRowsForResumen(left: RentRollMetricRow, right: RentRollMetricRow): number {
  const estadoRank = (estado: RentRollMetricRow["estado"]) =>
    estado === "OCUPADO" ? 0 : estado === "GRACIA" ? 1 : 2;
  const leftEstadoRank = estadoRank(left.estado);
  const rightEstadoRank = estadoRank(right.estado);
  if (leftEstadoRank !== rightEstadoRank) {
    return leftEstadoRank - rightEstadoRank;
  }
  if (left.diasVigentes !== right.diasVigentes) {
    return right.diasVigentes - left.diasVigentes;
  }
  if (left.ingresoBrutoUf !== right.ingresoBrutoUf) {
    return right.ingresoBrutoUf - left.ingresoBrutoUf;
  }
  return right.fechaTermino.localeCompare(left.fechaTermino);
}

