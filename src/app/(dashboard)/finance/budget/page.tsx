import { BudgetVsActualClient } from "@/components/rent-roll/BudgetVsActualClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function BudgetVsActualPage({
  searchParams,
}: {
  searchParams: { project?: string; from?: string; to?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Presupuesto vs Real"
        description="No hay proyectos activos. Crea uno para comparar presupuesto contra facturacion real."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <BudgetVsActualClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
