export const dynamic = "force-dynamic";

import { ContractStatus, MasterStatus, ContractRateType } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import {
  buildAlertCounts,
  buildIngresoDesglosado,
  buildOcupacionDetalle,
  buildRentaEnRiesgo,
  buildVencimientosPorAnio,
  calculateContractStateCounters,
  type KpiContractInput
} from "@/lib/kpi";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeEstadoContrato, startOfDay } from "@/lib/utils";
import { isPeriodoValido } from "@/lib/validators";
import { buildMetricsCacheKey, getOrSetMetricsCache } from "@/lib/metrics-cache";
import type { DashboardMetricasResponse } from "@/types/dashboard-metricas";

export const runtime = "nodejs";

function toPeriodo(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyecto");
    const periodo = searchParams.get("periodo") ?? toPeriodo(new Date());

    if (!proyectoId) {
      return NextResponse.json({ message: "proyecto es obligatorio." }, { status: 400 });
    }
    if (!isPeriodoValido(periodo)) {
      return NextResponse.json({ message: "periodo debe tener formato YYYY-MM." }, { status: 400 });
    }

    const cacheKey = buildMetricsCacheKey("dashboard-metricas", [proyectoId, periodo]);
    const payload = await getOrSetMetricsCache(
      cacheKey,
      proyectoId,
      120_000,
      async (): Promise<DashboardMetricasResponse> => {
        const today = startOfDay(new Date());
        const [localesActivos, contratosRaw, groupedStates, ventasPeriodo, energiaPeriodo, valorUf] =
          await Promise.all([
            prisma.unit.findMany({
              where: {
                proyectoId,
                estado: MasterStatus.ACTIVO
              },
              select: {
                id: true,
                codigo: true,
                esGLA: true,
                glam2: true,
                tipo: true,
                zona: true
              }
            }),
            prisma.contract.findMany({
              where: {
                proyectoId,
                estado: { not: ContractStatus.TERMINADO_ANTICIPADO },
                fechaInicio: { lte: today },
                fechaTermino: { gte: today }
              },
              orderBy: { fechaTermino: "asc" },
              select: {
                id: true,
                estado: true,
                localId: true,
                numeroContrato: true,
                fechaInicio: true,
                fechaTermino: true,
                diasGracia: true,
                local: {
                  select: {
                    codigo: true,
                    esGLA: true,
                    glam2: true
                  }
                },
                arrendatario: {
                  select: {
                    nombreComercial: true
                  }
                },
                tarifas: {
                  where: {
                    tipo: {
                      in: [
                        ContractRateType.FIJO_UF_M2,
                        ContractRateType.FIJO_UF,
                        ContractRateType.PORCENTAJE
                      ]
                    },
                    vigenciaDesde: { lte: today },
                    OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
                  },
                  orderBy: { vigenciaDesde: "desc" },
                  select: {
                    tipo: true,
                    valor: true
                  }
                },
                ggcc: {
                  where: {
                    vigenciaDesde: { lte: today }
                  },
                  orderBy: { vigenciaDesde: "desc" },
                  take: 1,
                  select: {
                    tarifaBaseUfM2: true,
                    pctAdministracion: true
                  }
                }
              }
            }),
            prisma.contract.groupBy({
              by: ["estado"],
              where: { proyectoId },
              _count: { _all: true }
            }),
            prisma.ventaLocal.findMany({
              where: {
                proyectoId,
                periodo
              },
              select: {
                localId: true,
                periodo: true,
                ventasUf: true
              }
            }),
            prisma.ingresoEnergia.findMany({
              where: {
                proyectoId,
                periodo
              },
              select: {
                localId: true,
                periodo: true,
                valorUf: true
              }
            }),
            prisma.valorUF.findFirst({
              orderBy: { fecha: "desc" },
              select: { fecha: true, valor: true }
            })
          ]);

        const contratosWithState = contratosRaw
          .map((contract) => {
          const estadoComputado = computeEstadoContrato(
            contract.fechaInicio,
            contract.fechaTermino,
            contract.diasGracia,
            contract.estado,
            today
          );
          const tarifaFija =
            contract.tarifas.find(
              (item) =>
                item.tipo === ContractRateType.FIJO_UF_M2 || item.tipo === ContractRateType.FIJO_UF
            ) ?? null;
          const tarifaVariable =
            contract.tarifas.find((item) => item.tipo === ContractRateType.PORCENTAJE) ?? null;

          return {
            estado: estadoComputado,
            data: {
              id: contract.id,
              localId: contract.localId,
              localCodigo: contract.local.codigo,
              localEsGLA: contract.local.esGLA,
              localGlam2: contract.local.glam2,
              arrendatarioNombre: contract.arrendatario.nombreComercial,
              numeroContrato: contract.numeroContrato,
              fechaTermino: contract.fechaTermino,
              tarifaVariablePct: tarifaVariable?.valor ?? null,
              tarifa: tarifaFija,
              ggcc: contract.ggcc[0] ?? null
            } satisfies KpiContractInput
          };
        })
        .filter(
          (contract) =>
            contract.estado === ContractStatus.VIGENTE || contract.estado === ContractStatus.GRACIA
        );

        const vigenteContracts = contratosWithState
          .filter((contract) => contract.estado === ContractStatus.VIGENTE)
          .map((contract) => contract.data);
        const graciaContracts = contratosWithState
          .filter((contract) => contract.estado === ContractStatus.GRACIA)
          .map((contract) => contract.data);
        const activeContracts = [...vigenteContracts, ...graciaContracts];

        const localesConContratoVigente = new Set(vigenteContracts.map((contract) => contract.localId));
        const localesEnGracia = new Set(
          graciaContracts
            .map((contract) => contract.localId)
            .filter((localId) => !localesConContratoVigente.has(localId))
        );
        const localesConArrendatario = new Set([...localesConContratoVigente, ...localesEnGracia]);
        const localesVacantes = localesActivos.filter((local) => !localesConArrendatario.has(local.id));

        const ocupacion = buildOcupacionDetalle(localesActivos, activeContracts);
        const ingresos = buildIngresoDesglosado(
          vigenteContracts,
          localesActivos,
          ventasPeriodo,
          energiaPeriodo,
          periodo
        );
        const alertas = buildAlertCounts(
          contratosWithState.map((contract) => ({
            estado: contract.estado,
            fechaTermino: contract.data.fechaTermino
          })),
          localesVacantes,
          today,
          proyectoId
        );
        const vencimientosPorAnio = buildVencimientosPorAnio(activeContracts);
        const cartera = calculateContractStateCounters(
          groupedStates.map((item) => ({ estado: item.estado, cantidad: item._count._all }))
        ).counters.map((counter) => ({
          estado: counter.estado,
          count: counter.cantidad,
          pct: counter.porcentaje
        }));
        const rentaEnRiesgo = buildRentaEnRiesgo(vigenteContracts, today, 90);

        return {
          ocupacion,
          ingresos,
          alertas,
          vencimientosPorAnio,
          valorUf: valorUf
            ? {
                valor: Number(valorUf.valor),
                fecha: toIsoDateString(valorUf.fecha)
              }
            : null,
          cartera,
          rentaEnRiesgo
        };
      }
    );

    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
