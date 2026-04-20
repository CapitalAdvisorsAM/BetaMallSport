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
import { toPeriodKey } from "@/lib/finance/period-range";
import {
  formatPeriodo,
  formatPercent,
  formatSquareMeters,
  formatUf
} from "@/lib/utils";
import { buildCategoryConcentration } from "@/lib/rent-roll/category-concentration";
import { buildVencimientosPorAnio } from "@/lib/kpi";
import { getTimelineData } from "@/lib/rent-roll/timeline";

const RentRollChartsSection = dynamic(
  () => import("@/components/rent-roll/RentRollChartsSection").then((m) => m.RentRollChartsSection),
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
  () => import("@/components/rent-roll/ExpirationProfileChart").then((m) => m.ExpirationProfileChart),
  { ssr: false, loading: () => <ModuleLoadingState shape="chart" /> }
);

const SPARK_POINTS = 8;

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
  const periodoActual = formatPeriodo(toPeriodKey(new Date()));

  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/");
  }

  const [timelineData, activeContracts, dashboardConfigRows, customWidgets] = await Promise.all([
    getTimelineData(selectedProjectId),
    prisma.contract.findMany({
      where: {
        proyectoId: selectedProjectId,
        estado: { in: ["VIGENTE", "GRACIA"] }
      },
      select: {
        fechaTermino: true,
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
  ]);

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

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Rent Roll"
        title="Dashboard Analítico"
        description={`Vista proactiva cruzando datos históricos y contractuales para proyecciones y tendencias. Periodo: ${periodoActual}.`}
      />

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
