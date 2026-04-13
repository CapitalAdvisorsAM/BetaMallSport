import { VentasAnalyticsClient } from "@/components/finance/VentasAnalyticsClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function FinanceVentasPage({
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
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para ver las ventas."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <VentasAnalyticsClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
