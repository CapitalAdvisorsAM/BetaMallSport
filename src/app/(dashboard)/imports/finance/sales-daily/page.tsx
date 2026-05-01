import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function ImportsSalesDailyPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const history = await getUploadHistory(
    selectedProjectId,
    DataUploadType.SALES_DAILY,
    "updated"
  );

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Realidad"
        title="Ventas Diarias"
        description="Lee la hoja 'Data Ventas' del CDG a granularidad diaria. Reemplaza los días presentes en el archivo."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ProcessingUploadCard
          title="Ventas Diarias"
          description="Carga la hoja 'Data Ventas' a granularidad diaria, manteniendo boletas, facturas y notas de crédito por día."
          instruction="CDG Mall Sport .xlsx -> hoja 'Data Ventas'"
          endpoint="/api/real/upload/sales-daily"
          projectId={selectedProjectId}
          variant="ventas"
        />
        <UploadHistory
          items={history}
          title="Ultimas cargas de ventas diarias"
          errorDownloadBasePath={null}
          countLabels={{ created: "Creados", updated: "Registros", rejected: "Errores" }}
        />
      </div>
    </main>
  );
}
