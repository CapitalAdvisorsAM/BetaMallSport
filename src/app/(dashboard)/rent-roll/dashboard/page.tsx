import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";

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

  const [timelineData, activeContracts] = await Promise.all([
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
    })
  ]);

  const categoryConcentration = buildCategoryConcentration(activeContracts);

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

      <RentRollChartsSection
        periodos={timelineData.periodos}
        categoryConcentration={categoryConcentration}
      />
    </main>
  );
}
