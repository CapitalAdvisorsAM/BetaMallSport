import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function ImportsBankPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const bankHistory = await getUploadHistory(
    selectedProjectId,
    DataUploadType.BANK,
    "created"
  );

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Realidad"
        title="Bancos"
        description="Lee la hoja 'Data Bco' y carga los movimientos bancarios mensuales."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ProcessingUploadCard
          title="Banco"
          description="Lee la hoja 'Data Bco' y carga los movimientos bancarios mensuales."
          instruction="CDG Mall Sport .xlsx -> hoja 'Data Bco'"
          endpoint="/api/real/upload/bank"
          projectId={selectedProjectId}
          variant="bank"
          templateHref="/api/real/upload/bank/template"
        />
        <UploadHistory
          items={bankHistory}
          title="Ultimas cargas de banco"
          errorDownloadBasePath={null}
          countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
        />
      </div>
    </main>
  );
}
