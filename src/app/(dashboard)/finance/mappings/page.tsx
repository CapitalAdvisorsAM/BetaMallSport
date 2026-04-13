import { FinanceMappingsClient } from "@/components/finance/FinanceMappingsClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { getFinanceMappingsData } from "@/lib/finance/mappings";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function FinanceMappingsPage({
  searchParams
}: {
  searchParams: { project?: string; tab?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para administrar mapeos entre finanzas y rent roll."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  const { accountingMappings, salesMappings, units } = await getFinanceMappingsData(selectedProjectId);
  const defaultTab = searchParams.tab === "sales" ? "sales" : searchParams.tab === "ventas" ? "sales" : "accounting";

  return (
    <FinanceMappingsClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      accountingMappings={accountingMappings}
      salesMappings={salesMappings}
      units={units}
      defaultTab={defaultTab}
    />
  );
}
