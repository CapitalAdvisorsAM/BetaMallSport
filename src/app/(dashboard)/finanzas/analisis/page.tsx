import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { AnalisisFinanzasClient } from "@/components/finanzas/AnalisisFinanzasClient";

export default async function AnalisisFinanzasPage({
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
        description="No hay proyectos activos. Crea uno para ver el análisis de facturación."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <AnalisisFinanzasClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.desde}
      defaultHasta={searchParams.hasta}
    />
  );
}
