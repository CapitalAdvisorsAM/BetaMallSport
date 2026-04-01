import { redirect } from "next/navigation";
import { RentRollChartsSection } from "@/components/rent-roll/RentRollChartsSection";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { buildCategoryConcentration } from "@/lib/rent-roll/category-concentration";
import { getTimelineData } from "@/lib/rent-roll/timeline";

type RentRollDashboardPageProps = {
  searchParams: {
    proyecto?: string;
  };
};

export default async function RentRollDashboardPage({
  searchParams
}: RentRollDashboardPageProps): Promise<JSX.Element> {
  const session = await requireSession();

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Dashboard Analitico"
        description="No hay proyectos activos. Crea uno para visualizar tendencias."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  if (searchParams.proyecto !== selectedProjectId) {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    redirect(`/rent-roll/dashboard?${params.toString()}`);
  }

  const [timelineData, activeContracts] = await Promise.all([
    getTimelineData(selectedProjectId),
    prisma.contrato.findMany({
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
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} />
        </div>
      </header>

      <RentRollChartsSection
        periodos={timelineData.periodos}
        categoryConcentration={categoryConcentration}
      />
    </main>
  );
}
