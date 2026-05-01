import { ContractStatus, UnitType, ContractRateType, Prisma } from "@prisma/client";
import { calculateWalt } from "@/lib/kpi";
import { prisma } from "@/lib/prisma";
import type { PeriodoMetrica, TimelineResponse } from "@/types/rent-roll-timeline";

function toPeriodoKey(date: Date | string): string {
  if (typeof date === "string") {
    return date.slice(0, 7);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parsePeriodoKey(periodo: string): { year: number; month: number } {
  const [yearStr, monthStr] = periodo.split("-");
  return { year: Number(yearStr), month: Number(monthStr) };
}

function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function endOfMonth(year: number, month: number): Date {
  // Contract dates are stored as date-only values at midnight, so the month
  // end snapshot must also use the last day at midnight to keep that day inclusive.
  return new Date(Date.UTC(year, month, 0));
}

function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + n, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampLeasedGla(value: number, glaTotalM2: number): number {
  if (glaTotalM2 <= 0) return 0;
  return Math.min(round2(value), glaTotalM2);
}

function isBodegaEspacio(tipo: UnitType): boolean {
  return tipo === UnitType.BODEGA || tipo === UnitType.ESPACIO;
}

function isSimuladorModulo(tipo: UnitType): boolean {
  return tipo === UnitType.SIMULADOR || tipo === UnitType.MODULO;
}

// ---------------------------------------------------------------------------
// Variable rent data helpers
// ---------------------------------------------------------------------------

type ContractWithPct = {
  localId: string;
  fechaInicio: Date;
  fechaTermino: Date;
  tarifas: Array<{ valor: Prisma.Decimal; vigenciaDesde: Date; vigenciaHasta: Date | null }>;
};

type VariableRentData = {
  ventaMap: Map<string, { rentaVariableUf: number; ventasTotalUf: number }>;
  contractsWithPct: ContractWithPct[];
};

type HistoricalDayRow = {
  fecha: Date;
  localId: string;
  contratoId: string | null;
  estadoDia: string;
  glam2: number;
  tarifaDia: number;
  tipo: UnitType;
  localEsGLA: boolean;
  fechaTermino: Date | null;
};

type FutureContractRow = {
  id: string;
  localId: string;
  fechaInicio: Date;
  fechaTermino: Date;
  local: {
    id: string;
    tipo: UnitType;
    glam2: Prisma.Decimal;
    esGLA: boolean;
  };
  tarifas: Array<{
    tipo: ContractRateType;
    valor: Prisma.Decimal;
    vigenciaDesde: Date;
    vigenciaHasta: Date | null;
  }>;
};

function isOccupiedStatus(estadoDia: string): boolean {
  return estadoDia === "OCUPADO" || estadoDia === "GRACIA";
}

function preferHistoricalDay(current: HistoricalDayRow | undefined, candidate: HistoricalDayRow): HistoricalDayRow {
  if (!current) return candidate;
  if (!current.fechaTermino) return candidate;
  if (!candidate.fechaTermino) return current;
  return candidate.fechaTermino >= current.fechaTermino ? candidate : current;
}

function uniqueOccupiedGlaRows(rows: HistoricalDayRow[]): HistoricalDayRow[] {
  const byLocal = new Map<string, HistoricalDayRow>();

  for (const row of rows) {
    if (!row.localEsGLA || !isOccupiedStatus(row.estadoDia)) continue;
    byLocal.set(row.localId, preferHistoricalDay(byLocal.get(row.localId), row));
  }

  return [...byLocal.values()];
}

function preferFutureContract(
  current: FutureContractRow | undefined,
  candidate: FutureContractRow
): FutureContractRow {
  if (!current) return candidate;
  return candidate.fechaTermino >= current.fechaTermino ? candidate : current;
}

function uniqueActiveGlaContractsAtMonthEnd(
  contracts: FutureContractRow[],
  monthEnd: Date
): FutureContractRow[] {
  const byLocal = new Map<string, FutureContractRow>();

  for (const contract of contracts) {
    if (!contract.local.esGLA) continue;
    if (contract.fechaInicio > monthEnd || contract.fechaTermino < monthEnd) continue;
    byLocal.set(contract.localId, preferFutureContract(byLocal.get(contract.localId), contract));
  }

  return [...byLocal.values()];
}

async function buildVariableRentData(proyectoId: string): Promise<VariableRentData> {
  const [ventas, contractsRaw] = await Promise.all([
    prisma.tenantSale.findMany({
      where: { projectId: proyectoId },
      select: { tenantId: true, period: true, salesPesos: true },
    }),
    prisma.contract.findMany({
      where: { projectId: proyectoId },
      select: {
        localId: true,
        arrendatarioId: true,
        fechaInicio: true,
        fechaTermino: true,
        tarifas: {
          where: { supersededAt: null, tipo: ContractRateType.PORCENTAJE },
          select: { valor: true, umbralVentasUf: true, vigenciaDesde: true, vigenciaHasta: true },
        },
      },
    }),
  ]);

  const contractsWithPct = contractsRaw.filter((c) => c.tarifas.length > 0);
  const contractByTenantId = new Map(contractsWithPct.map((c) => [c.arrendatarioId, c]));

  const ventaMap = new Map<string, { rentaVariableUf: number; ventasTotalUf: number }>();

  for (const venta of ventas) {
    const contract = contractByTenantId.get(venta.tenantId);
    if (!contract) continue;

    // Find the PORCENTAJE tiers active at the mid-point of the period
    const periodKey = venta.period.toISOString().slice(0, 7);
    const midMonth = new Date(`${periodKey}-15`);
    const activeTarifas = contract.tarifas.filter(
      (t) => t.vigenciaDesde <= midMonth && (t.vigenciaHasta === null || t.vigenciaHasta >= midMonth)
    );
    if (activeTarifas.length === 0) continue;

    const ventasUf = venta.salesPesos.toNumber();
    const tiers = activeTarifas.map((t) => ({
      umbralVentasUf: t.umbralVentasUf?.toNumber() ?? 0,
      pct: t.valor.toNumber(),
    }));
    const sorted = [...tiers].sort((a, b) => b.umbralVentasUf - a.umbralVentasUf);
    const selectedTier = sorted.find((t) => ventasUf >= t.umbralVentasUf);
    if (!selectedTier) continue;
    const rentaVar = round2(ventasUf * (selectedTier.pct / 100));
    const existing = ventaMap.get(periodKey) ?? { rentaVariableUf: 0, ventasTotalUf: 0 };
    ventaMap.set(periodKey, {
      rentaVariableUf: round2(existing.rentaVariableUf + rentaVar),
      ventasTotalUf: round2(existing.ventasTotalUf + ventasUf),
    });
  }

  return { ventaMap, contractsWithPct };
}

function computePctPromedioForPeriodo(
  periodo: string,
  contractsWithPct: ContractWithPct[]
): number | null {
  const { year, month } = parsePeriodoKey(periodo);
  const periodStart = startOfMonth(year, month);
  const periodEnd = endOfMonth(year, month);
  const midMonth = new Date((periodStart.getTime() + periodEnd.getTime()) / 2);

  const pcts: number[] = [];
  for (const c of contractsWithPct) {
    if (c.fechaInicio > periodEnd || c.fechaTermino < periodStart) continue;
    const rate = c.tarifas.find(
      (t) => t.vigenciaDesde <= midMonth && (t.vigenciaHasta === null || t.vigenciaHasta >= midMonth)
    );
    if (rate) pcts.push(rate.valor.toNumber());
  }

  if (pcts.length === 0) return null;
  return round2(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}

async function buildHistoricalPeriodos(
  proyectoId: string,
  glaTotalM2: number,
  localesGLA: number,
  currentPeriodo: string,
  variableRentData: VariableRentData
): Promise<PeriodoMetrica[]> {
  // Fetch ContratoDia records limited to the last 36 months for performance
  const HISTORY_MONTHS = 36;
  const cutoffDate = new Date();
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - HISTORY_MONTHS);
  cutoffDate.setUTCDate(1);
  cutoffDate.setUTCHours(0, 0, 0, 0);

  const allDias = await prisma.contractDay.findMany({
    where: { projectId: proyectoId, fecha: { gte: cutoffDate } },
    select: {
      fecha: true,
      localId: true,
      contratoId: true,
      estadoDia: true,
      glam2: true,
      tarifaDia: true,
      local: {
        select: {
          tipo: true,
          esGLA: true
        }
      },
      contrato: {
        select: {
          fechaTermino: true
        }
      }
    },
    orderBy: { fecha: "asc" }
  });

  if (allDias.length === 0) {
    return [];
  }

  // Group by "YYYY-MM"
  const byMonth = new Map<
    string,
    HistoricalDayRow[]
  >();

  for (const dia of allDias) {
    const key = toPeriodoKey(dia.fecha);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push({
      fecha: dia.fecha,
      localId: dia.localId,
      contratoId: dia.contratoId,
      estadoDia: dia.estadoDia,
      glam2: dia.glam2.toNumber(),
      tarifaDia: dia.tarifaDia.toNumber(),
      tipo: dia.local.tipo,
      localEsGLA: dia.local.esGLA,
      fechaTermino: dia.contrato?.fechaTermino ?? null
    });
  }

  const vencimientosByMonth = new Map<string, number>();
  const vencimientoIds = new Set<string>();
  for (const dia of allDias) {
    if (!dia.contratoId || !dia.contrato?.fechaTermino || vencimientoIds.has(dia.contratoId)) {
      continue;
    }
    vencimientoIds.add(dia.contratoId);
    const key = toPeriodoKey(dia.contrato.fechaTermino);
    vencimientosByMonth.set(key, (vencimientosByMonth.get(key) ?? 0) + 1);
  }

  const result: PeriodoMetrica[] = [];

  for (const [periodo, dias] of byMonth.entries()) {
    // Skip current or future months
    if (periodo >= currentPeriodo) continue;

    // Get the last date in this month to use as snapshot
    const dates = [...new Set(dias.map((d) => d.fecha.toISOString()))].sort();
    const lastDateStr = dates[dates.length - 1];
    const lastDateDias = dias.filter((d) => d.fecha.toISOString() === lastDateStr);

    const occupiedRows = uniqueOccupiedGlaRows(lastDateDias);
    const glaArrendadaM2 = clampLeasedGla(
      occupiedRows.reduce((sum, d) => sum + d.glam2, 0),
      glaTotalM2
    );
    const glaVacanteM2 = round2(Math.max(glaTotalM2 - glaArrendadaM2, 0));
    const pctVacanciaGLA = round2(glaTotalM2 > 0 ? (glaVacanteM2 / glaTotalM2) * 100 : 0);
    const localesArrendados = occupiedRows.length;
    const localesVacantes = Math.max(localesGLA - localesArrendados, 0);

    // contratosActivos: distinct contratoIds where estadoDia IN [OCUPADO, GRACIA] on last day
    const activeContratoIds = new Set(
      lastDateDias
        .filter((d) => d.estadoDia === "OCUPADO" || d.estadoDia === "GRACIA")
        .map((d) => d.contratoId)
        .filter((id): id is string => id !== null)
    );
    const contratosActivos = activeContratoIds.size;

    const activeContractsForWalt = Array.from(
      occupiedRows.reduce(
        (acc, dia) => {
          if (
            !dia.contratoId ||
            !dia.fechaTermino
          ) {
            return acc;
          }
          if (!acc.has(dia.localId)) {
            acc.set(dia.localId, {
              fechaTermino: dia.fechaTermino,
              localGlam2: dia.glam2
            });
          }
          return acc;
        },
        new Map<string, { fechaTermino: Date; localGlam2: number }>()
      ).values()
    );
    const snapshotDate = new Date(lastDateStr);
    const waltMeses = round2(calculateWalt(activeContractsForWalt, snapshotDate));

    // rentaFijaUf: sum of tarifaDia * glam2 for all days in the month,
    // then divide by unique dates count to normalize to monthly
    const uniqueDatesCount = dates.length;
    const rentaSumAllDays = dates.reduce((sum, dateKey) => {
      const dayRows = dias.filter((d) => d.fecha.toISOString() === dateKey);
      return sum + uniqueOccupiedGlaRows(dayRows).reduce((daySum, d) => daySum + d.tarifaDia * d.glam2, 0);
    }, 0);
    const rentaFijaUf = round2(uniqueDatesCount > 0 ? rentaSumAllDays / uniqueDatesCount : 0);

    // pctOcupacionGLA
    const pctOcupacionGLA = round2(glaTotalM2 > 0 ? (glaArrendadaM2 / glaTotalM2) * 100 : 0);

    // Ingresos breakdown by type using last day snapshot
    const activeDiasLastDay = occupiedRows;

    const ingresosFijoUf = round2(
      activeDiasLastDay
        .filter((d) => !isBodegaEspacio(d.tipo) && !isSimuladorModulo(d.tipo))
        .reduce((sum, d) => sum + d.tarifaDia * d.glam2, 0)
    );

    const ingresosSimuladorModuloUf = round2(
      activeDiasLastDay
        .filter((d) => isSimuladorModulo(d.tipo))
        .reduce((sum, d) => sum + d.tarifaDia * d.glam2, 0)
    );

    const ingresosBodegaEspacioUf = round2(
      activeDiasLastDay
        .filter((d) => isBodegaEspacio(d.tipo))
        .reduce((sum, d) => sum + d.tarifaDia * d.glam2, 0)
    );

    const contratosQueVencenEsteMes = vencimientosByMonth.get(periodo) ?? 0;
    const ventaEntry = variableRentData.ventaMap.get(periodo);

    result.push({
      periodo,
      esFuturo: false,
      pctOcupacionGLA,
      pctVacanciaGLA,
      waltMeses,
      glaArrendadaM2,
      glaVacanteM2,
      glaTotalM2,
      localesArrendados,
      localesVacantes,
      localesGLA,
      rentaFijaUf,
      contratosActivos,
      ingresosFijoUf,
      ingresosSimuladorModuloUf,
      ingresosBodegaEspacioUf,
      contratosQueVencenEsteMes,
      rentaVariableUf: ventaEntry?.rentaVariableUf ?? null,
      ventasTotalUf: ventaEntry?.ventasTotalUf ?? null,
      pctRentaVariableContratoPromedio: computePctPromedioForPeriodo(
        periodo,
        variableRentData.contractsWithPct
      ),
    });
  }

  return result.sort((a, b) => a.periodo.localeCompare(b.periodo));
}

async function buildFuturePeriodos(
  proyectoId: string,
  glaTotalM2: number,
  localesGLA: number,
  currentPeriodo: string,
  variableRentData: VariableRentData
): Promise<PeriodoMetrica[]> {
  // Fetch all active/vigente contracts with locales and tarifas
  const activeContracts = await prisma.contract.findMany({
    where: {
      projectId: proyectoId,
      estado: { not: ContractStatus.TERMINADO_ANTICIPADO },
      cuentaParaVacancia: true
    },
    select: {
      id: true,
      localId: true,
      fechaInicio: true,
      fechaTermino: true,
      local: {
        select: {
          id: true,
          tipo: true,
          glam2: true,
          esGLA: true
        }
      },
      tarifas: {
        where: {
          supersededAt: null,
          tipo: { in: [ContractRateType.FIJO_UF_M2, ContractRateType.FIJO_UF] }
        },
        select: {
          tipo: true,
          valor: true,
          vigenciaDesde: true,
          vigenciaHasta: true
        },
        orderBy: { vigenciaDesde: "desc" }
      }
    }
  });

  if (activeContracts.length === 0) return [];

  // Find max fechaTermino across all active contracts
  let maxFechaTermino: Date | null = null;
  for (const c of activeContracts) {
    if (!maxFechaTermino || c.fechaTermino > maxFechaTermino) {
      maxFechaTermino = c.fechaTermino;
    }
  }

  if (!maxFechaTermino) return [];

  const maxPeriodo = toPeriodoKey(maxFechaTermino);

  // Build month sequence from currentPeriodo to maxPeriodo (inclusive)
  const months: string[] = [];
  let { year, month } = parsePeriodoKey(currentPeriodo);
  while (true) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= maxPeriodo) break;
    const next = addMonths(year, month, 1);
    year = next.year;
    month = next.month;
  }

  // Vencimientos: how many contracts end in each month
  const vencimientosByMonth = new Map<string, number>();
  for (const c of activeContracts) {
    const key = toPeriodoKey(c.fechaTermino);
    vencimientosByMonth.set(key, (vencimientosByMonth.get(key) ?? 0) + 1);
  }

  const result: PeriodoMetrica[] = [];

  for (const periodo of months) {
    const { year: y, month: m } = parsePeriodoKey(periodo);
    const monthStart = startOfMonth(y, m);
    const monthEnd = endOfMonth(y, m);
    const activeAtMonthEnd = uniqueActiveGlaContractsAtMonthEnd(activeContracts, monthEnd);

    let glaArrendadaM2 = 0;
    let rentaFijaUf = 0;
    let ingresosFijoUf = 0;
    let ingresosSimuladorModuloUf = 0;
    let ingresosBodegaEspacioUf = 0;

    for (const c of activeAtMonthEnd) {
      const glam2 = c.local.glam2.toNumber();
      glaArrendadaM2 += glam2;

      // Find the most recent tarifa vigente for the midpoint of this month
      const midMonth = new Date((monthStart.getTime() + monthEnd.getTime()) / 2);
      const tarifaVigente = c.tarifas.find((t) => {
        const desde = t.vigenciaDesde;
        const hasta = t.vigenciaHasta;
        return desde <= midMonth && (hasta === null || hasta >= midMonth);
      });

      let renta = 0;
      if (tarifaVigente) {
        const valor = tarifaVigente.valor.toNumber();
        if (tarifaVigente.tipo === ContractRateType.FIJO_UF_M2) {
          renta = valor * glam2;
        } else {
          // FIJO_UF
          renta = valor;
        }
      }

      rentaFijaUf += renta;

      const tipo = c.local.tipo;
      if (isSimuladorModulo(tipo)) {
        ingresosSimuladorModuloUf += renta;
      } else if (isBodegaEspacio(tipo)) {
        ingresosBodegaEspacioUf += renta;
      } else {
        ingresosFijoUf += renta;
      }
    }

    glaArrendadaM2 = clampLeasedGla(glaArrendadaM2, glaTotalM2);
    const glaVacanteM2 = round2(Math.max(glaTotalM2 - glaArrendadaM2, 0));
    const pctOcupacionGLA = round2(glaTotalM2 > 0 ? (glaArrendadaM2 / glaTotalM2) * 100 : 0);
    const pctVacanciaGLA = round2(glaTotalM2 > 0 ? (glaVacanteM2 / glaTotalM2) * 100 : 0);
    const localesArrendados = activeAtMonthEnd.length;
    const localesVacantes = Math.max(localesGLA - localesArrendados, 0);
    const contratosActivos = activeAtMonthEnd.length;
    const waltMeses = round2(
      calculateWalt(
        activeAtMonthEnd.map((contract) => ({
          fechaTermino: contract.fechaTermino,
          localGlam2: contract.local.glam2
        })),
        monthEnd
      )
    );

    result.push({
      periodo,
      esFuturo: periodo > currentPeriodo,
      pctOcupacionGLA,
      pctVacanciaGLA,
      waltMeses,
      glaArrendadaM2,
      glaVacanteM2,
      glaTotalM2,
      localesArrendados,
      localesVacantes,
      localesGLA,
      rentaFijaUf: round2(rentaFijaUf),
      contratosActivos,
      ingresosFijoUf: round2(ingresosFijoUf),
      ingresosSimuladorModuloUf: round2(ingresosSimuladorModuloUf),
      ingresosBodegaEspacioUf: round2(ingresosBodegaEspacioUf),
      contratosQueVencenEsteMes: vencimientosByMonth.get(periodo) ?? 0,
      // Variable rent can't be projected without a sales forecast
      rentaVariableUf: null,
      ventasTotalUf: null,
      pctRentaVariableContratoPromedio: computePctPromedioForPeriodo(
        periodo,
        variableRentData.contractsWithPct
      ),
    });
  }

  return result;
}

export async function getTimelineData(proyectoId: string, asOfDate?: Date | string): Promise<TimelineResponse> {
  // Get all active locales to compute glaTotalM2, and variable rent data in parallel
  const [projectSnapshot, localesActivos, variableRentData] = await Promise.all([
    prisma.project.findUnique({
      where: { id: proyectoId },
      select: { reportDate: true },
    }),
    prisma.unit.findMany({
      where: { projectId: proyectoId, estado: "ACTIVO", esGLA: true },
      select: { glam2: true },
    }),
    buildVariableRentData(proyectoId),
  ]);

  const glaTotalM2 = round2(localesActivos.reduce((sum, l) => sum + l.glam2.toNumber(), 0));
  const localesGLA = localesActivos.length;

  const referenceDate = asOfDate ?? projectSnapshot?.reportDate ?? new Date();
  const currentPeriodo = toPeriodoKey(referenceDate);

  const [historical, future] = await Promise.all([
    buildHistoricalPeriodos(proyectoId, glaTotalM2, localesGLA, currentPeriodo, variableRentData),
    buildFuturePeriodos(proyectoId, glaTotalM2, localesGLA, currentPeriodo, variableRentData),
  ]);

  const periodosByKey = new Map<string, PeriodoMetrica>();
  for (const periodo of historical) {
    periodosByKey.set(periodo.periodo, periodo);
  }
  for (const periodo of future) {
    periodosByKey.set(periodo.periodo, periodo);
  }

  const periodos = [...periodosByKey.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));

  return { asOfPeriodo: currentPeriodo, periodos };
}

