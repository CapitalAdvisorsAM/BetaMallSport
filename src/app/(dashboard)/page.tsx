import { ContractStatus, MasterStatus, ContractRateType } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertBar } from "@/components/dashboard/AlertBar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { VencimientosPorAnioTable } from "@/components/dashboard/VencimientosPorAnioTable";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import {
  OCCUPANCY_HIGH_THRESHOLD,
  OCCUPANCY_LOW_THRESHOLD,
  MS_PER_DAY,
  UF_STALENESS_DAYS
} from "@/lib/constants";
import {
  buildAlertCounts,
  buildIngresoDesglosado,
  buildOcupacionDetalle,
  buildRentaEnRiesgo,
  buildRentaPotencialVacantes,
  buildVencimientosPorAnio,
  calculateContractStateCounters,
  calculateEstimatedGgccUf,
  formatPercent,
  formatSquareMeters,
  type KpiContractInput
} from "@/lib/kpi";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";
import type { MetricFormulaId } from "@/lib/metric-formulas";
import { isPeriodoValido } from "@/lib/validators";
import { formatUf, startOfDay } from "@/lib/utils";
import { resolveWidgetConfigs, type ResolvedWidgetConfig } from "@/lib/dashboard/widget-registry";

type DashboardPageProps = {
  searchParams: {
    project?: string;
    proyecto?: string;
    periodo?: string;
  };
};

type CarteraCardConfig = {
  title: string;
  accent: "green" | "yellow" | "red" | "slate";
  metricId: MetricFormulaId;
  subtitle?: string;
};

const CARTERA_CARD_CONFIG: Record<ContractStatus, CarteraCardConfig> = {
  VIGENTE: {
    title: "Vigentes",
    accent: "green",
    metricId: "kpi_dashboard_cartera_vigentes"
  },
  GRACIA: {
    title: "En periodo de gracia",
    accent: "yellow",
    metricId: "kpi_dashboard_cartera_gracia",
    subtitle: "Sin ingreso hasta inicio efectivo"
  },
  TERMINADO_ANTICIPADO: {
    title: "Terminados anticipadamente",
    accent: "red",
    metricId: "kpi_dashboard_cartera_terminado_anticipado",
    subtitle: "Rescision antes del plazo pactado"
  },
  TERMINADO: {
    title: "Terminados",
    accent: "slate",
    metricId: "kpi_dashboard_cartera_terminado"
  }
};

function formatPeriodo(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatClp(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export default async function DashboardPage({
  searchParams
}: DashboardPageProps): Promise<JSX.Element> {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }

  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);
  if (!selectedProjectId) {
    return (
      <main className="rounded-md bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Control de Gestion
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">Selecciona un proyecto para ver el dashboard.</p>
      </main>
    );
  }

  const currentPeriodo = formatPeriodo(new Date());
  const periodo = isPeriodoValido(searchParams.periodo ?? "") ? (searchParams.periodo as string) : currentPeriodo;

  if (projectParam !== selectedProjectId || searchParams.periodo !== periodo) {
    const params = new URLSearchParams();
    params.set("project", selectedProjectId);
    params.set("proyecto", selectedProjectId);
    params.set("periodo", periodo);
    redirect(`/?${params.toString()}`);
  }

  const today = startOfDay(new Date());
  const [activeLocales, activeContractsRaw, groupedStates, latestValorUf, ventasPeriodo, energiaPeriodo, dashboardConfigRows] =
    await Promise.all([
      prisma.unit.findMany({
        where: {
          proyectoId: selectedProjectId,
          estado: MasterStatus.ACTIVO
        },
        orderBy: { codigo: "asc" },
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
          proyectoId: selectedProjectId,
          estado: {
            in: [ContractStatus.VIGENTE, ContractStatus.GRACIA]
          }
        },
        orderBy: { fechaTermino: "asc" },
        select: {
          id: true,
          estado: true,
          localId: true,
          numeroContrato: true,
          fechaTermino: true,
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
        where: { proyectoId: selectedProjectId },
        _count: { _all: true }
      }),
      prisma.valorUF.findFirst({
        orderBy: { fecha: "desc" },
        select: { fecha: true, valor: true }
      }),
      prisma.ventaLocal.findMany({
        where: {
          proyectoId: selectedProjectId,
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
          proyectoId: selectedProjectId,
          periodo
        },
        select: {
          localId: true,
          periodo: true,
          valorUf: true
        }
      }),
      prisma.dashboardConfig.findMany({ orderBy: { position: "asc" } }),
    ]);

  const widgetConfigs = resolveWidgetConfigs(dashboardConfigRows);
  const configMap = new Map<string, ResolvedWidgetConfig>(widgetConfigs.map((c) => [c.widgetId, c]));

  function isEnabled(widgetId: string): boolean {
    return configMap.get(widgetId)?.enabled ?? true;
  }
  function getVariant(widgetId: string): string {
    return configMap.get(widgetId)?.formulaVariant ?? "";
  }
  function getParam(widgetId: string, key: string, defaultVal: number): number {
    const val = configMap.get(widgetId)?.parameters[key];
    return typeof val === "number" ? val : defaultVal;
  }

  const contractsWithState = activeContractsRaw.map((contract) => {
    const tarifaFija =
      contract.tarifas.find(
        (item) =>
          item.tipo === ContractRateType.FIJO_UF_M2 || item.tipo === ContractRateType.FIJO_UF
      ) ?? null;
    const tarifaVariable =
      contract.tarifas.find((item) => item.tipo === ContractRateType.PORCENTAJE) ?? null;

    return {
      estado: contract.estado,
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
  });

  const vigenteContracts = contractsWithState
    .filter((contract) => contract.estado === ContractStatus.VIGENTE)
    .map((contract) => contract.data);
  const graciaContracts = contractsWithState
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
  const localesVacantes = activeLocales.filter((local) => !localesConArrendatario.has(local.id));

  // Apply occupancy variant: "solo_vigente" excludes GRACIA from occupied count
  const ocupacionContracts =
    getVariant("kpi_ocupacion_pct") === "solo_vigente" ? vigenteContracts : activeContracts;

  const ocupacion = buildOcupacionDetalle(activeLocales, ocupacionContracts);
  const ingresos = buildIngresoDesglosado(
    vigenteContracts,
    activeLocales,
    ventasPeriodo,
    energiaPeriodo,
    periodo
  );
  const ggccUf = calculateEstimatedGgccUf(vigenteContracts);
  const diasRiesgo = getParam("kpi_renta_en_riesgo", "dias", 90);
  const rentaEnRiesgo = buildRentaEnRiesgo(vigenteContracts, today, diasRiesgo);
  const vencimientosPorAnio = buildVencimientosPorAnio(activeContracts).filter((row) => {
    const currentYear = today.getFullYear();
    return row.anio >= currentYear && row.anio <= currentYear + 5;
  });
  const contractStates = calculateContractStateCounters(
    groupedStates.map((item) => ({ estado: item.estado, cantidad: item._count._all }))
  );

  const alertCounts = buildAlertCounts(
    contractsWithState.map((contract) => ({
      estado: contract.estado,
      fechaTermino: contract.data.fechaTermino
    })),
    localesVacantes,
    today,
    selectedProjectId
  );

  const pctOcupacion = ocupacion.glaTotal > 0 ? (ocupacion.glaArrendada / ocupacion.glaTotal) * 100 : 0;
  const occupancyUmbralAlto = getParam("kpi_ocupacion_pct", "umbralAlto", OCCUPANCY_HIGH_THRESHOLD);
  const occupancyUmbralBajo = getParam("kpi_ocupacion_pct", "umbralBajo", OCCUPANCY_LOW_THRESHOLD);
  const occupancyAccent =
    pctOcupacion >= occupancyUmbralAlto
      ? "green"
      : pctOcupacion >= occupancyUmbralBajo
        ? "yellow"
        : "red";

  const localesVacantesGla = localesVacantes.filter((local) => local.esGLA);
  const rentaPotencialVacantes = buildRentaPotencialVacantes(
    localesVacantesGla,
    ingresos.arriendoFijoUfM2
  );

  const contratosConGgcc = vigenteContracts.filter((contract) => contract.ggcc !== null).length;
  const contratosSinGgcc = vigenteContracts.length - contratosConGgcc;

  const salesByLocal = new Map(ventasPeriodo.map((venta) => [venta.localId, Number(venta.ventasUf)]));
  const contratosVariableConVentas = vigenteContracts.filter(
    (contract) => Number(contract.tarifaVariablePct?.toString() ?? "0") > 0 && salesByLocal.has(contract.localId)
  ).length;
  const localById = new Map(activeLocales.map((local) => [local.id, local]));
  const simuladorModuloUnidades = new Set(
    vigenteContracts
      .map((contract) => localById.get(contract.localId))
      .filter((local): local is (typeof activeLocales)[number] => {
        if (!local) {
          return false;
        }
        return local.tipo === "SIMULADOR" || local.tipo === "MODULO";
      })
      .map((local) => local.id)
  ).size;

  const ufAgeDays =
    latestValorUf === null
      ? null
      : Math.floor((today.getTime() - startOfDay(latestValorUf.fecha).getTime()) / MS_PER_DAY);
  const isUfStale = ufAgeDays !== null && ufAgeDays > UF_STALENESS_DAYS;
  const ingresoMensualClp = latestValorUf ? ingresos.totalUf * Number(latestValorUf.valor) : 0;

  const bodegaEspacioUf = ingresos.arriendoBodegaUf + ingresos.arriendoEspacioUf;
  const bodegaEspacioSubtitle =
    ingresos.arriendoBodegaUf > 0 || ingresos.arriendoEspacioUf > 0
      ? `Bodega: ${formatUf(ingresos.arriendoBodegaUf)} UF · Espacio: ${formatUf(
          ingresos.arriendoEspacioUf
        )} UF`
      : "Sin ingresos de bodega o espacio en el periodo";

  return (
    <main className="space-y-6">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gold-400" />
            <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
              Control de Gestion
            </h2>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ periodo }}
          />
          <Link
            href={`/rent-roll/dashboard?project=${selectedProjectId}&proyecto=${selectedProjectId}`}
            className="ml-auto flex items-center gap-1 rounded-full border border-brand-300 px-4 py-1.5 text-sm font-medium text-brand-500 transition-colors hover:text-brand-700"
          >
            Ver Rent Roll -&gt;
          </Link>
        </div>
      </header>

      <AlertBar {...alertCounts} />

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">Ocupacion</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isEnabled("kpi_ocupacion_pct") && (
            <KpiCard
              metricId="kpi_dashboard_ocupacion_pct"
              title="Ocupacion del proyecto"
              value={formatPercent(pctOcupacion)}
              subtitle={`${localesConContratoVigente.size} vigentes · ${localesEnGracia.size} en gracia · ${localesVacantes.length} vacantes`}
              accent={occupancyAccent}
            />
          )}
          {isEnabled("kpi_gla_arrendada") && (
            <KpiCard
              metricId="kpi_dashboard_gla_arrendada_m2"
              title="GLA arrendada"
              value={formatSquareMeters(ocupacion.glaArrendada)}
              subtitle={`GLA vacante: ${formatSquareMeters(ocupacion.glaVacante)}`}
              subtitleClassName={ocupacion.glaVacante > 0 ? "text-rose-600" : "text-slate-500"}
              accent="slate"
            />
          )}
          {isEnabled("kpi_locales_sin_arrendatario") && (
            <KpiCard
              metricId="kpi_dashboard_locales_sin_arrendatario"
              title="Locales sin arrendatario"
              value={localesVacantes.length.toString()}
              subtitle={
                localesVacantes.length > 0
                  ? `~${formatUf(rentaPotencialVacantes)} UF/mes de ingreso potencial`
                  : "Sin vacantes"
              }
              subtitleClassName={localesVacantes.length > 0 ? "text-rose-600" : "text-emerald-600"}
              accent={localesVacantes.length > 0 ? "red" : "green"}
            />
          )}
          {isEnabled("kpi_renta_en_riesgo") && (
            <KpiCard
              metricId="kpi_dashboard_renta_riesgo_90d_uf"
              title={`Renta en riesgo (${diasRiesgo}d)`}
              value={`${formatUf(rentaEnRiesgo.ufEnRiesgo)} UF`}
              subtitle={`de ${rentaEnRiesgo.count} contratos proximos a vencer`}
              accent={rentaEnRiesgo.ufEnRiesgo > 0 ? "red" : "green"}
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
              Ingresos del periodo - {periodo}
            </h3>
            {ingresos.ventaEnergiaUf > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                ⚡ Energia: {formatUf(ingresos.ventaEnergiaUf)} UF
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {isEnabled("kpi_facturacion_total") && (
            <KpiCard
              metricId="kpi_dashboard_facturacion_total_uf"
              title="Facturacion total (UF)"
              value={formatUf(ingresos.totalUf)}
              subtitle={`${formatUf(ingresos.facturacionUfM2, 3)} UF/m2`}
              accent="slate"
            />
          )}
          {isEnabled("kpi_arriendo_fijo") && (
            <KpiCard
              metricId="kpi_dashboard_arriendo_fijo_uf"
              title="Arriendo fijo (UF)"
              value={formatUf(ingresos.arriendoFijoUf)}
              subtitle={`${formatUf(ingresos.arriendoFijoUfM2, 3)} UF/m2`}
              accent="slate"
            />
          )}
          {isEnabled("kpi_ingreso_clp") && (
            <KpiCard
              metricId="kpi_dashboard_ingreso_mensual_clp"
              title="Ingreso mensual (CLP)"
              value={latestValorUf ? formatClp(ingresoMensualClp) : "Sin valor UF"}
              subtitle={
                latestValorUf
                  ? `UF ${formatUf(Number(latestValorUf.valor), 2)} al ${formatShortDate(latestValorUf.fecha)}`
                  : "No hay valor UF registrado"
              }
              accent="slate"
              detail={
                isUfStale ? (
                  <p className="text-xs font-semibold text-amber-700">⚠ Valor UF desactualizado</p>
                ) : null
              }
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {isEnabled("kpi_renta_variable") && (
            <KpiCard
              metricId="kpi_dashboard_renta_variable_uf"
              title="Renta variable"
              value={`${formatUf(ingresos.arriendoVariableUf)} UF`}
              subtitle={`% sobre ventas de ${contratosVariableConVentas} contratos`}
              accent="slate"
            />
          )}
          {isEnabled("kpi_simuladores_modulos") && (
            <KpiCard
              metricId="kpi_dashboard_simuladores_modulos_uf"
              title="Simuladores/Mod."
              value={`${formatUf(ingresos.simuladoresModulosUf)} UF`}
              subtitle={`${simuladorModuloUnidades} unidades`}
              accent="slate"
            />
          )}
          {isEnabled("kpi_bodega_espacio") && (
            <KpiCard
              metricId="kpi_dashboard_bodega_espacio_uf"
              title="Bodega + Espacio"
              value={`${formatUf(bodegaEspacioUf)} UF`}
              subtitle={bodegaEspacioSubtitle}
              accent="slate"
            />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">GGCC</h3>
        </div>
        {isEnabled("kpi_ggcc_mensual") && (
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              metricId="kpi_dashboard_ggcc_mensual_uf"
              title="Gasto comun mensual (UF)"
              value={formatUf(ggccUf)}
              subtitle={`${contratosConGgcc} contratos con datos · ${contratosSinGgcc} sin datos`}
              accent="slate"
              titleAttribute="Gastos comunes de administracion de areas compartidas"
            />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-md bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-brand-700">Vencimientos por ano</h3>
          <p className="mt-1 text-sm text-slate-600">Maximo 5 anos hacia adelante desde hoy.</p>
        </div>
        <VencimientosPorAnioTable rows={vencimientosPorAnio} currentYear={today.getFullYear()} />
        <div className="border-t border-slate-200 px-4 py-3 text-right text-sm">
          <Link
            href={`/rent-roll/dashboard?project=${selectedProjectId}&proyecto=${selectedProjectId}`}
            className="text-brand-500 underline hover:text-brand-700"
          >
            Ver detalle de vencimientos en Rent Roll -&gt;
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Estado de cartera
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {contractStates.counters
            .filter((counter) => {
              const widgetId = `kpi_cartera_${counter.estado.toLowerCase()}` as string;
              return isEnabled(widgetId);
            })
            .map((counter) => {
              const config = CARTERA_CARD_CONFIG[counter.estado];
              return (
                <KpiCard
                  key={counter.estado}
                  metricId={config.metricId}
                  title={config.title}
                  value={counter.cantidad.toString()}
                  subtitle={config.subtitle}
                  accent={config.accent}
                />
              );
            })}
        </div>
      </section>
    </main>
  );
}
