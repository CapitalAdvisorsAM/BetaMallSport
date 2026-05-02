import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { AccountingImportsTabsClient } from "@/components/real/AccountingImportsTabsClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function ImportsAccountingPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const accountingHistory = await getUploadHistory(
    selectedProjectId,
    DataUploadType.ACCOUNTING,
    "created"
  );

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Realidad"
        title="Contabilidad"
        description="Carga datos contables desde el archivo CDG o corrige registros individuales directamente."
      />

      <AccountingImportsTabsClient
        projectId={selectedProjectId}
        uploadHistory={accountingHistory}
      />
    </main>
  );
}
