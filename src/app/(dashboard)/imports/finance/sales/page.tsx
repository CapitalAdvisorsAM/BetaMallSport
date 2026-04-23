import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function ImportsSalesPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const salesHistory = await getUploadHistory(
    selectedProjectId,
    DataUploadType.SALES,
    "updated"
  );

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Realidad"
        title="Ventas Reales"
        description="Lee la hoja 'Data Ventas' del archivo CDG y agrega ventas diarias por local y mes."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ProcessingUploadCard
          title="Datos de Ventas"
          description="Lee la hoja 'Data Ventas' del archivo CDG y agrega ventas diarias por local y mes."
          instruction="CDG Mall Sport .xlsx -> hoja 'Data Ventas'"
          endpoint="/api/real/upload/sales"
          projectId={selectedProjectId}
          variant="ventas"
          templateHref="/api/real/upload/sales/template"
        />
        <UploadHistory
          items={salesHistory}
          title="Ultimas cargas de ventas"
          errorDownloadBasePath={null}
          countLabels={{ created: "Creados", updated: "Registros", rejected: "Errores" }}
        />
      </div>
    </main>
  );
}
