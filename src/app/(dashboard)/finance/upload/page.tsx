import { DataUploadType } from "@prisma/client";
import { FinanceUploadClient } from "@/components/finance/FinanceUploadClient";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function FinanceUploadPage({
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
        description="No hay proyectos activos. Crea uno para cargar datos contables y ventas."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  const [accountingHistory, salesHistory] = await Promise.all([
    getUploadHistory(selectedProjectId, DataUploadType.ACCOUNTING, "created"),
    getUploadHistory(selectedProjectId, DataUploadType.SALES, "updated")
  ]);

  return (
    <FinanceUploadClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      accountingHistory={accountingHistory}
      salesHistory={salesHistory}
    />
  );
}
