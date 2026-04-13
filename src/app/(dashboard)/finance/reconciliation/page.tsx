import { ReconciliationClient } from "@/components/finance/ReconciliationClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function ReconciliationPage({
  searchParams
}: {
  searchParams: { project?: string; from?: string; to?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Reconciliacion"
        description="No hay proyectos activos. Crea uno para analizar brechas de facturacion."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <ReconciliationClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
