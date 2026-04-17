"use client";

import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import type { UploadHistoryItem } from "@/lib/upload/history";

type FinanceUploadClientProps = {
  selectedProjectId: string;
  accountingHistory: UploadHistoryItem[];
  salesHistory: UploadHistoryItem[];
  budgetedSalesHistory: UploadHistoryItem[];
};

export function FinanceUploadClient({
  selectedProjectId,
  accountingHistory,
  salesHistory,
  budgetedSalesHistory
}: FinanceUploadClientProps): JSX.Element {
  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Cargar Datos"
        description='Sube el archivo CDG (.xlsx) para procesar las hojas "Data Contable" y "Data Ventas".'
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4">
          <ProcessingUploadCard
            title="Datos Contables"
            description="Lee la hoja 'Data Contable' del archivo CDG y filtra Ce.coste = 'Real'."
            instruction="CDG Mall Sport .xlsx -> hoja 'Data Contable'"
            endpoint="/api/finance/upload/accounting"
            projectId={selectedProjectId}
            variant="contable"
          />
          <UploadHistory
            items={accountingHistory}
            title="Ultimas cargas contables"
            errorDownloadBasePath={null}
            countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
          />
        </div>

        <div className="space-y-4">
          <ProcessingUploadCard
            title="Datos de Ventas"
            description="Lee la hoja 'Data Ventas' del archivo CDG y agrega ventas diarias por local y mes."
            instruction="CDG Mall Sport .xlsx -> hoja 'Data Ventas'"
            endpoint="/api/finance/upload/sales"
            projectId={selectedProjectId}
            variant="ventas"
          />
          <UploadHistory
            items={salesHistory}
            title="Ultimas cargas de ventas"
            errorDownloadBasePath={null}
            countLabels={{ created: "Creados", updated: "Registros", rejected: "Errores" }}
          />
        </div>

        <div className="space-y-4">
          <ProcessingUploadCard
            title="Ventas Presupuestadas"
            description="Sube ventas presupuestadas por local y periodo para el calculo de renta variable esperada."
            instruction=".xlsx -> hoja 'Data Presupuesto' o 'Presupuesto Ventas'"
            endpoint="/api/finance/upload/budgeted-sales"
            projectId={selectedProjectId}
            variant="ventas"
          />
          <UploadHistory
            items={budgetedSalesHistory}
            title="Ultimas cargas de presupuesto"
            errorDownloadBasePath={null}
            countLabels={{ created: "Creados", updated: "Registros", rejected: "Errores" }}
          />
        </div>
      </div>
    </main>
  );
}



