import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { EERRClient } from "@/components/finanzas/EERRClient";

export default async function EERRPage({
  searchParams
}: {
  searchParams: { proyecto?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para visualizar el estado de resultados."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <EERRClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.desde}
      defaultHasta={searchParams.hasta}
    />
  );
}
