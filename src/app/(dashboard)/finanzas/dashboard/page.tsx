import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { DashboardFinanzasClient } from "@/components/finanzas/DashboardFinanzasClient";

export default async function DashboardFinanzasPage({
  searchParams
}: {
  searchParams: { proyecto?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para ver el dashboard financiero."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return <DashboardFinanzasClient projects={projects} selectedProjectId={selectedProjectId} />;
}
