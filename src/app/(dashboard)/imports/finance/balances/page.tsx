import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function ImportsBalancesPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const balancesHistory = await getUploadHistory(
    selectedProjectId,
    DataUploadType.BALANCES,
    "created"
  );

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Realidad"
        title="Balances"
        description="Lee la hoja 'Data Balances' y carga el estado de situación financiera mensual en UF."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ProcessingUploadCard
          title="Balances"
          description="Lee la hoja 'Data Balances' y carga el estado de situación financiera mensual en UF."
          instruction="CDG Mall Sport .xlsx -> hoja 'Data Balances'"
          endpoint="/api/real/upload/balances"
          projectId={selectedProjectId}
          variant="balances"
          templateHref="/api/real/upload/balances/template"
        />
        <UploadHistory
          items={balancesHistory}
          title="Ultimas cargas de balances"
          errorDownloadBasePath={null}
          countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
        />
      </div>
    </main>
  );
}
