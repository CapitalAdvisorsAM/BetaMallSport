import { CostoOcupacionClient } from "@/components/finance/CostoOcupacionClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function FinanceCostoOcupacionPage({
  searchParams
}: {
  searchParams: { project?: string; to?: string; hasta?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para ver el costo de ocupacion."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <CostoOcupacionClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultPeriod={searchParams.to ?? searchParams.hasta}
    />
  );
}
