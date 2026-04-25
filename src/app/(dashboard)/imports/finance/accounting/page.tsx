import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import { UploadHistory } from "@/components/upload/UploadHistory";
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
        description="Lee la hoja 'Data Contable' del archivo CDG y filtra Ce.coste = 'Real'."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ProcessingUploadCard
          title="Datos Contables"
          description="Lee la hoja 'Data Contable' del archivo CDG y filtra Ce.coste = 'Real'."
          instruction="CDG Mall Sport .xlsx -> hoja 'Data Contable'"
          endpoint="/api/real/upload/accounting"
          projectId={selectedProjectId}
          variant="contable"
          templateHref="/api/real/upload/accounting/template"
        />
        <UploadHistory
          items={accountingHistory}
          title="Ultimas cargas contables"
          errorDownloadBasePath={null}
          countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
        />
      </div>
    </main>
  );
}
