import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
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
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";
import { buildCategoryConcentration } from "@/lib/rent-roll/category-concentration";
import { getTimelineData } from "@/lib/rent-roll/timeline";

type RentRollDashboardPageProps = {
  searchParams: {
    project?: string;
    proyecto?: string;
  };
};

export default async function RentRollDashboardPage({
  searchParams
}: RentRollDashboardPageProps): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);

  const { selectedProjectId } = await getProjectContext(projectParam);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Dashboard Analitico"
        description="No hay proyectos activos. Crea uno para visualizar tendencias."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  if (projectParam !== selectedProjectId) {
    const params = new URLSearchParams();
    params.set("project", selectedProjectId);
    params.set("proyecto", selectedProjectId);
    redirect(`/rent-roll/dashboard?${params.toString()}`);
  }

  const [timelineData, activeContracts, dashboardConfigRows, customWidgets] = await Promise.all([
    getTimelineData(selectedProjectId),
    prisma.contract.findMany({
      where: {
        proyectoId: selectedProjectId,
        estado: { in: ["VIGENTE", "GRACIA"] }
      },
      select: {
        local: {
          select: {
            glam2: true,
            zona: true
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

  const categoryConcentration = buildCategoryConcentration(activeContracts);

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
    </main>
  );
}
