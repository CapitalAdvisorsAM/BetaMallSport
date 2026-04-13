import { WaterfallClient } from "@/components/finance/WaterfallClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function WaterfallPage({
  searchParams,
}: {
  searchParams: { project?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Waterfall de Ingresos"
        description="No hay proyectos activos. Crea uno para analizar la variacion de ingresos."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <WaterfallClient
      projects={projects}
      selectedProjectId={selectedProjectId}
    />
  );
}
