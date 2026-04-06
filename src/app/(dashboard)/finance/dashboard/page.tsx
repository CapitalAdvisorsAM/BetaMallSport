import { FinanceDashboardClient } from "@/components/finance/FinanceDashboardClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function FinanceDashboardPage({
  searchParams
}: {
  searchParams: { project?: string; proyecto?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para ver el dashboard financiero."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return <FinanceDashboardClient projects={projects} selectedProjectId={selectedProjectId} />;
}
