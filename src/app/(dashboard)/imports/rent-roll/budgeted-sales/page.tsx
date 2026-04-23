import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function ImportsBudgetedSalesPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const budgetedSalesHistory = await getUploadHistory(
    selectedProjectId,
    DataUploadType.BUDGETED_SALES,
    "updated"
  );

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Expectativa"
        title="Ventas Presupuestadas"
        description="Sube ventas presupuestadas por local y periodo para el calculo de renta variable esperada."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ProcessingUploadCard
          title="Ventas Presupuestadas"
          description="Sube ventas presupuestadas por local y periodo para el calculo de renta variable esperada."
          instruction=".xlsx -> hoja 'Data Presupuesto' o 'Presupuesto Ventas'"
          endpoint="/api/real/upload/budgeted-sales"
          projectId={selectedProjectId}
          variant="ventas"
          templateHref="/api/real/upload/budgeted-sales/template"
        />
        <UploadHistory
          items={budgetedSalesHistory}
          title="Ultimas cargas de presupuesto"
          errorDownloadBasePath={null}
          countLabels={{ created: "Creados", updated: "Registros", rejected: "Errores" }}
        />
      </div>
    </main>
  );
}
