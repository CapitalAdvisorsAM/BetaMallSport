import { FinanceTenantsClient } from "@/components/finance/FinanceTenantsClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function FinanceTenantsPage({
  searchParams
}: {
  searchParams: { project?: string; proyecto?: string; from?: string; to?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para analizar la facturación por arrendatario."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <FinanceTenantsClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
