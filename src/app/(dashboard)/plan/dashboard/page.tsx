import { AccountingScenario } from "@prisma/client";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/permissions";
import { resolveWidgetConfigs } from "@/lib/dashboard/widget-registry";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import {
  evaluateFormula,
  type DisplayFormat,
  type FormulaConfig
} from "@/lib/dashboard/custom-widget-engine";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { toPeriodKey } from "@/lib/real/period-range";
import { pivotAccounting, pivotSum } from "@/lib/real/accounting-pivot";
import {
  formatPeriodo,
  formatPercent,
  formatSquareMeters,
  formatUf
} from "@/lib/utils";
import { buildCategoryConcentration } from "@/lib/plan/category-concentration";
import { buildVencimientosPorAnio, INGRESO_GROUP3 } from "@/lib/kpi";
import { getTimelineData } from "@/lib/plan/timeline";

const RentRollChartsSection = dynamic(
  () => import("@/components/plan/RentRollChartsSection").then((m) => m.RentRollChartsSection),
  {
    ssr: false,
    loading: () => (
      <section className="space-y-4">
        <ModuleLoadingState shape="kpis" />
        <ModuleLoadingState shape="chart" />
      </section>
    )
  }
);

const ExpirationProfileChart = dynamic(
  () => import("@/components/plan/ExpirationProfileChart").then((m) => m.ExpirationProfileChart),
  { ssr: false, loading: () => <ModuleLoadingState shape="chart" /> }
);

const SPARK_POINTS = 8;

type PlanKpi = {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  sparkline?: number[];
  trend?: { value: number };
};

function buildPlanExclusiveKpis(periodos: ReturnType<typeof getTimelineData> extends Promise<infer T> ? (T extends { periodos: infer P } ? P : never) : never): PlanKpi[] {
  const historical = periodos.filter((p) => !p.esFuturo);
  if (historical.length === 0) return [];

  const latest = historical[historical.length - 1];
  const previous = historical.length >= 2 ? historical[historical.length - 2] : null;
  const subtitle = formatPeriodoShort(latest.periodo);
  const sparkSlice = historical.slice(-SPARK_POINTS);

  function trendOf(current: number, prior: number | null): { value: number } | undefined {
    if (prior === null || prior === 0) return undefined;
    return { value: ((current - prior) / Math.abs(prior)) * 100 };
  }

  const vacancyCurrent = latest.glaTotalM2 > 0 ? latest.pctVacanciaGLA : 0;
  const vacancyPrior = previous && previous.glaTotalM2 > 0 ? previous.pctVacanciaGLA : null;

  const ufPerM2Current =
    latest.glaArrendadaM2 > 0 ? latest.rentaFijaUf / latest.glaArrendadaM2 : 0;
  const ufPerM2Prior =
    previous && previous.glaArrendadaM2 > 0 ? previous.rentaFijaUf / previous.glaArrendadaM2 : null;

  const kpis: PlanKpi[] = [
    {
      id: "plan_ocupacion_pct",
      title: "% Ocupacion GLA",
      value: formatPercent(latest.pctOcupacionGLA),
      subtitle: `${formatSquareMeters(latest.glaArrendadaM2)} / ${formatSquareMeters(latest.glaTotalM2)}`,
      sparkline: sparkSlice.map((p) => p.pctOcupacionGLA),
      trend: trendOf(latest.pctOcupacionGLA, previous?.pctOcupacionGLA ?? null)
    },
    {
      id: "plan_gla_arrendada",
      title: "GLA arrendada",
      value: formatSquareMeters(latest.glaArrendadaM2),
      subtitle: `${latest.localesArrendados} locales ocupados`,
      sparkline: sparkSlice.map((p) => p.glaArrendadaM2),
      trend: trendOf(latest.glaArrendadaM2, previous?.glaArrendadaM2 ?? null)
    },
    {
      id: "plan_gla_vacante",
      title: "GLA vacante",
      value: formatSquareMeters(latest.glaVacanteM2),
      subtitle: `${formatPercent(vacancyCurrent)} de vacancia - ${latest.localesVacantes} locales`,
      sparkline: sparkSlice.map((p) => p.glaVacanteM2),
      trend: trendOf(vacancyCurrent, vacancyPrior)
    },
    {
      id: "plan_uf_por_m2_arrendado",
      title: "UF / m2 arrendado",
      value: formatUf(ufPerM2Current, 3),
      subtitle: `${formatUf(latest.rentaFijaUf, 0)} renta fija`,
      sparkline: sparkSlice.map((p) =>
        p.glaArrendadaM2 > 0 ? p.rentaFijaUf / p.glaArrendadaM2 : 0
      ),
      trend: trendOf(ufPerM2Current, ufPerM2Prior)
    }
  ];

  return kpis;

}

function formatWidgetValue(value: number, format: DisplayFormat): string {
  switch (format) {
    case "percent":
      return formatPercent(value);
    case "uf":
      return formatUf(value);
    case "m2":
      return formatSquareMeters(value);
    case "months":
      return value >= 12 ? `${(value / 12).toFixed(1)} años` : `${value.toFixed(1)} meses`;
    default:
      return formatUf(value);
  }
}

const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatPeriodoShort(periodo: string): string {
  const [yearStr, monthStr] = periodo.split("-");
  const monthIdx = Number(monthStr) - 1;
  const year = String(Number(yearStr)).slice(-2);
  return `${MESES_ES[monthIdx] ?? monthStr} ${year}`;
}

export default async function RentRollDashboardPage(): Promise<JSX.Element> {
  await requireSession();

  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/");
  }

  const projectSnapshot = await prisma.project.findUnique({
    where: { id: selectedProjectId },
    select: { reportDate: true }
  });
  const asOfDate = projectSnapshot?.reportDate ?? new Date();
  const periodoActual = formatPeriodo(toPeriodKey(asOfDate));

  const periodKey = toPeriodKey(asOfDate);
  const periodDate = new Date(`${periodKey}-01`);

  const [timelineData, activeContracts, dashboardConfigRows, customWidgets, accountingPivot] =
    await Promise.all([
      getTimelineData(selectedProjectId, asOfDate),
      prisma.contract.findMany({
        where: {
          projectId: selectedProjectId,
          estado: { in: ["VIGENTE", "GRACIA"] },
          // Restrict to the snapshot window so totales y conteos cuadren con
          // los KPIs del header (que filtran por fecha en timeline.ts).
          fechaInicio: { lte: asOfDate },
          fechaTermino: { gte: asOfDate }
        },
        select: {
          fechaTermino: true,
          cuentaParaVacancia: true,
          local: {
            select: {
              glam2: true,
              zona: { select: { nombre: true } }
            }
          }
        }
      }),
      prisma.dashboardConfig.findMany({ orderBy: { position: "asc" } }),
      prisma.customWidget.findMany({ where: { enabled: true }, orderBy: { position: "asc" } }),
      pivotAccounting(selectedProjectId, {
        from: periodDate,
        to: periodDate,
        group1: "INGRESOS DE EXPLOTACION",
        scenarios: [AccountingScenario.REAL, AccountingScenario.PPTO]
      })
    ]);

  const ingresoGroups = [
    ...INGRESO_GROUP3.arriendoFijoUf,
    ...INGRESO_GROUP3.arriendoVariableUf,
    ...INGRESO_GROUP3.simuladoresModulosUf,
    ...INGRESO_GROUP3.arriendoEspacioUf,
    ...INGRESO_GROUP3.arriendoBodegaUf,
    ...INGRESO_GROUP3.ventaEnergiaUf
  ];
  const ingresoRealUf = pivotSum(accountingPivot, periodKey, ingresoGroups, AccountingScenario.REAL);
  const ingresoPptoUf = pivotSum(accountingPivot, periodKey, ingresoGroups, AccountingScenario.PPTO);
  const ingresoVarianza = ingresoPptoUf > 0 ? ((ingresoRealUf - ingresoPptoUf) / ingresoPptoUf) * 100 : null;

  const widgetConfigs = resolveWidgetConfigs(dashboardConfigRows);
  const enabledCharts = new Set(
    widgetConfigs.filter((c) => c.enabled && c.widgetId.startsWith("chart_")).map((c) => c.widgetId)
  );
  const waltConfig = widgetConfigs.find((c) => c.widgetId === "chart_ocupacion_walt");
  const waltVariant = waltConfig?.formulaVariant ?? "con_walt";

  const categoryConcentration = buildCategoryConcentration(
    activeContracts.map((c) => ({ ...c, local: { ...c.local, zona: c.local.zona?.nombre ?? null } }))
  );

  const currentYear = new Date().getFullYear();
  const vencimientosPorAnio = buildVencimientosPorAnio(
    activeContracts.map((c) => ({
      localId: "",
      localGlam2: c.local.glam2,
      tarifa: null,
      tarifaVariablePct: null,
      fechaTermino: c.fechaTermino
    }))
  ).filter((row) => row.anio >= currentYear && row.anio <= currentYear + 5);

  const mappedWidgets = customWidgets.map((w) => ({
    id: w.id,
    title: w.title,
    chartType: w.chartType,
    enabled: w.enabled,
    position: w.position,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formulaConfig: w.formulaConfig as any as FormulaConfig,
  }));

  const kpiWidgets = mappedWidgets
    .filter((w) => w.chartType === "kpi")
    .map((w) => {
      const points = evaluateFormula(timelineData.periodos, w.formulaConfig);
      const historical = points.filter((p) => !p.esFuturo && p.value !== null);
      if (historical.length === 0) {
        return { id: w.id, title: w.title, value: "\u2014", subtitle: "Sin datos" };
      }
      const latest = historical[historical.length - 1];
      const prev = historical.length >= 2 ? historical[historical.length - 2] : null;
      const latestValue = latest.value as number;
      const prevValue = prev?.value ?? null;
      const deltaPct =
        prevValue !== null && prevValue !== 0
          ? ((latestValue - prevValue) / Math.abs(prevValue)) * 100
          : null;
      const sparkValues = historical.slice(-SPARK_POINTS).map((p) => p.value as number);
      return {
        id: w.id,
        title: w.title,
        value: formatWidgetValue(latestValue, w.formulaConfig.format),
        subtitle: formatPeriodoShort(latest.periodo),
        sparkline: sparkValues,
        trend: deltaPct !== null ? { value: deltaPct } : undefined,
      };
    });

  const chartWidgets = mappedWidgets.filter((w) => w.chartType !== "kpi");

  const planKpis = buildPlanExclusiveKpis(timelineData.periodos);

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Expectativa"
        title="Dashboard Analítico"
        description={`Vista proactiva cruzando datos históricos y contractuales para proyecciones y tendencias. Periodo: ${periodoActual}.`}
      />

      {planKpis.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {planKpis.map((k) => (
            <KpiCard
              key={k.id}
              title={k.title}
              value={k.value}
              subtitle={k.subtitle}
              sparkline={k.sparkline}
              trend={k.trend}
            />
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Ingreso contable Real"
          value={formatUf(ingresoRealUf, 0)}
          subtitle={`Contable · ${formatPeriodoShort(periodKey)}`}
          trend={ingresoVarianza !== null ? { value: ingresoVarianza } : undefined}
        />
        <KpiCard
          title="Ingreso contable Ppto"
          value={formatUf(ingresoPptoUf, 0)}
          subtitle={`Presupuesto · ${formatPeriodoShort(periodKey)}`}
        />
        <KpiCard
          title="Brecha Real vs Ppto"
          value={formatUf(ingresoRealUf - ingresoPptoUf, 0)}
          subtitle={
            ingresoVarianza !== null
              ? `${formatPercent(ingresoVarianza)} sobre presupuesto`
              : "Sin presupuesto cargado"
          }
        />
      </div>


      {kpiWidgets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiWidgets.map((k) => (
            <KpiCard
              key={k.id}
              title={k.title}
              value={k.value}
              subtitle={k.subtitle}
              sparkline={k.sparkline}
              trend={k.trend}
            />
          ))}
        </div>
      )}

      <RentRollChartsSection
        periodos={timelineData.periodos}
        categoryConcentration={categoryConcentration}
        referencePeriodo={timelineData.asOfPeriodo}
        enabledCharts={enabledCharts}
        waltVariant={waltVariant}
        customWidgets={chartWidgets}
      />

      {vencimientosPorAnio.length > 0 && (
        <section className="overflow-hidden rounded-md bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-700">Perfil de vencimientos por año</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              GLA (m²) de contratos vigentes que vencen cada año en los próximos 5 años.
            </p>
          </div>
          <ExpirationProfileChart data={vencimientosPorAnio} />
        </section>
      )}
    </main>
  );
}
