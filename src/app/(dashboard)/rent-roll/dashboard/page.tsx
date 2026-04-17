import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/permissions";
import { resolveWidgetConfigs } from "@/lib/dashboard/widget-registry";
import { CustomKpiCard } from "@/components/rent-roll/CustomKpiCard";
import type { FormulaConfig } from "@/lib/dashboard/custom-widget-engine";

const RentRollChartsSection = dynamic(
  () => import("@/components/rent-roll/RentRollChartsSection").then((m) => m.RentRollChartsSection),
  {
    ssr: false,
    loading: () => (
      <section className="space-y-4">
        <div className="h-14 animate-pulse rounded-md bg-slate-100" />
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      </section>
    )
  }
);
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { toPeriodKey } from "@/lib/finance/period-range";
import { formatPeriodo } from "@/lib/utils";
import { buildCategoryConcentration } from "@/lib/rent-roll/category-concentration";
import { buildVencimientosPorAnio } from "@/lib/kpi";
import { getTimelineData } from "@/lib/rent-roll/timeline";

const ExpirationProfileChart = dynamic(
  () => import("@/components/rent-roll/ExpirationProfileChart").then((m) => m.ExpirationProfileChart),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-md bg-slate-100" /> }
);

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

  const kpiWidgets = mappedWidgets.filter((w) => w.chartType === "kpi");
  const chartWidgets = mappedWidgets.filter((w) => w.chartType !== "kpi");

  return (
    <main className="space-y-4">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                Dashboard Analitico
              </h2>
              <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-brand-50 text-brand-700">
                {periodoActual}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Vista proactiva cruzando datos historicos y contractuales para ver proyecciones y
              tendencias.
            </p>
          </div>
        </div>
      </header>

      {kpiWidgets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiWidgets.map((widget) => (
            <CustomKpiCard
              key={widget.id}
              widget={widget}
              periodos={timelineData.periodos}
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
            <h3 className="text-sm font-semibold text-brand-700">Perfil de vencimientos por ano</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              GLA (m²) de contratos vigentes que vencen cada ano en los proximos 5 anos.
            </p>
          </div>
          <ExpirationProfileChart data={vencimientosPorAnio} />
        </section>
      )}
    </main>
  );
}
