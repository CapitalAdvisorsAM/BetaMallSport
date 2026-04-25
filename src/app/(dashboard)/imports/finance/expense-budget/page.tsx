import { DataUploadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function ImportsExpenseBudgetPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/imports");
  }

  const expenseBudgetHistory = await getUploadHistory(
    selectedProjectId,
    DataUploadType.EXPENSE_BUDGET,
    "created"
  );

  return (
    <main className="space-y-4">
      <ModuleHeader
        overline="Carga de Datos · Realidad"
        title="Presupuesto de Gastos"
        description="Sube el presupuesto anual de gastos por grupo contable (Marketing, Inmobiliaria, Vacancia, etc.)."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ProcessingUploadCard
          title="Presupuesto de Gastos"
          description="Sube el presupuesto anual de gastos por grupo contable (Marketing, Inmobiliaria, Vacancia, etc.)."
          instruction=".xlsx -> hoja 'Presupuesto' con columnas Periodo, GRUPO 1, GRUPO 3, Valor UF"
          endpoint="/api/real/upload/expense-budget"
          projectId={selectedProjectId}
          variant="expense-budget"
          templateHref="/api/real/upload/expense-budget/template"
        />
        <UploadHistory
          items={expenseBudgetHistory}
          title="Ultimas cargas de PPTO gastos"
          errorDownloadBasePath={null}
          countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
        />
      </div>
    </main>
  );
}
