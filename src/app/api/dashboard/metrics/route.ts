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
import { buildUfRateMap } from "@/lib/real/uf-lookup";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeEstadoContrato, startOfDay } from "@/lib/utils";
import { isPeriodoValido } from "@/lib/validators";
import { buildMetricsCacheKey, getOrSetMetricsCache } from "@/lib/metrics-cache";
import type { DashboardMetricsResponse } from "@/types/dashboard-metrics";

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
    const proyectoId = searchParams.get("projectId");
    const periodo = searchParams.get("periodo") ?? toPeriodo(new Date());

    if (!proyectoId) {
      return NextResponse.json({ message: "projectId es obligatorio." }, { status: 400 });
    }
    if (!isPeriodoValido(periodo)) {
      return NextResponse.json({ message: "periodo debe tener formato YYYY-MM." }, { status: 400 });
    }

    const cacheKey = buildMetricsCacheKey("dashboard-metrics", [proyectoId, periodo]);
    const payload = await getOrSetMetricsCache(
      cacheKey,
      proyectoId,
      120_000,
      async (): Promise<DashboardMetricsResponse> => {
        const today = startOfDay(new Date());
        const [localesActivos, contratosRaw, groupedStates, ventasPeriodoRaw, energiaPeriodoRaw, valorUf] =
          await Promise.all([
            prisma.unit.findMany({
              where: {
                projectId: proyectoId,
                estado: MasterStatus.ACTIVO
              },
              select: {
                id: true,
                codigo: true,
                esGLA: true,
                glam2: true,
                tipo: true,
                zona: { select: { nombre: true } }
              }
            }),
            prisma.contract.findMany({
              where: {
                projectId: proyectoId,
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
                cuentaParaVacancia: true,
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
                    supersededAt: null,
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
                    valor: true,
                    umbralVentasUf: true
                  }
                },
                ggcc: {
                  where: {
                    supersededAt: null,
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
              where: { projectId: proyectoId },
              _count: { _all: true }
            }),
            prisma.tenantSale.findMany({
              where: {
                projectId: proyectoId,
                period: new Date(`${periodo}-01`)
              },
              select: {
                tenantId: true,
                period: true,
                salesPesos: true
              }
            }),
            prisma.ingresoEnergia.findMany({
              where: {
                projectId: proyectoId,
                periodo: new Date(`${periodo}-01`)
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

        const ventasPeriodo = ventasPeriodoRaw.map((sale) => ({
          arrendatarioId: sale.tenantId,
          periodo: sale.period.toISOString().slice(0, 7),
          ventasPesos: sale.salesPesos
        }));
        const energiaPeriodo = energiaPeriodoRaw.map((energy) => ({
          localId: energy.localId,
          periodo: energy.periodo.toISOString().slice(0, 7),
          valorUf: energy.valorUf
        }));

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
          const tarifasVariable = contract.tarifas.filter(
            (item) => item.tipo === ContractRateType.PORCENTAJE
          );
          const variableRentTiers = tarifasVariable.map((t) => ({
            umbralVentasUf: Number(t.umbralVentasUf?.toString() ?? "0"),
            pct: Number(t.valor.toString())
          }));

          return {
            estado: estadoComputado,
            cuentaParaVacancia: contract.cuentaParaVacancia,
            data: {
              id: contract.id,
              localId: contract.localId,
              localCodigo: contract.local.codigo,
              localEsGLA: contract.local.esGLA,
              localGlam2: contract.local.glam2,
              arrendatarioNombre: contract.arrendatario.nombreComercial,
              numeroContrato: contract.numeroContrato,
              fechaTermino: contract.fechaTermino,
              tarifaVariablePct: tarifasVariable[0]?.valor ?? null,
              variableRentTiers: variableRentTiers.length > 0 ? variableRentTiers : undefined,
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

        // Solo los contratos marcados `cuentaParaVacancia=true` ocupan el local
        // para efectos de los KPIs de ocupacion / vacancia. Los contratos
        // excluidos siguen vigentes para renta y GGCC, pero su local aparece
        // como vacante en la vista de ocupacion.
        const localIdsOcupanParaVacancia = new Set(
          contratosWithState
            .filter((contract) => contract.cuentaParaVacancia)
            .map((contract) => contract.data.localId)
        );
        const vigenteContractsParaOcupacion = vigenteContracts.filter((contract) =>
          localIdsOcupanParaVacancia.has(contract.localId)
        );
        const graciaContractsParaOcupacion = graciaContracts.filter((contract) =>
          localIdsOcupanParaVacancia.has(contract.localId)
        );
        const activeContractsParaOcupacion = [
          ...vigenteContractsParaOcupacion,
          ...graciaContractsParaOcupacion
        ];

        const localesConContratoVigente = new Set(
          vigenteContractsParaOcupacion.map((contract) => contract.localId)
        );
        const localesEnGracia = new Set(
          graciaContractsParaOcupacion
            .map((contract) => contract.localId)
            .filter((localId) => !localesConContratoVigente.has(localId))
        );
        const localesConArrendatario = new Set([...localesConContratoVigente, ...localesEnGracia]);
        const localesVacantes = localesActivos.filter((local) => !localesConArrendatario.has(local.id));

        const localesActivosMapped = localesActivos.map((l) => ({ ...l, zona: l.zona?.nombre ?? null }));
        const ocupacion = buildOcupacionDetalle(localesActivosMapped, activeContractsParaOcupacion);
        const ufRateMap = await buildUfRateMap([periodo]);
        const ufRateForPeriodo = ufRateMap.get(periodo) ?? (valorUf ? Number(valorUf.valor.toString()) : 0);
        const ingresos = buildIngresoDesglosado(
          vigenteContracts,
          localesActivosMapped,
          ventasPeriodo,
          energiaPeriodo,
          periodo,
          ufRateForPeriodo
        );
        const alertas = buildAlertCounts(
          contratosWithState.map((contract) => ({
            estado: contract.estado,
            fechaTermino: contract.data.fechaTermino
          })),
          localesVacantes,
          today
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

