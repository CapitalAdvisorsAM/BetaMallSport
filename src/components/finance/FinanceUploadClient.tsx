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
  expenseBudgetHistory: UploadHistoryItem[];
  balancesHistory: UploadHistoryItem[];
  bankHistory: UploadHistoryItem[];
};

export function FinanceUploadClient({
  selectedProjectId,
  accountingHistory,
  salesHistory,
  budgetedSalesHistory,
  expenseBudgetHistory,
  balancesHistory,
  bankHistory
}: FinanceUploadClientProps): JSX.Element {
  return (
    <main className="stagger space-y-4">
      <ModuleHeader
        overline="Datos · Ingesta"
        title="Cargar Datos"
        description='Sube el archivo CDG (.xlsx) para procesar las hojas "Data Contable" y "Data Ventas", o carga el presupuesto de gastos.'
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-4">
          <ProcessingUploadCard
            title="Datos Contables"
            description="Lee la hoja 'Data Contable' del archivo CDG y filtra Ce.coste = 'Real'."
            instruction="CDG Mall Sport .xlsx -> hoja 'Data Contable'"
            endpoint="/api/finance/upload/accounting"
            projectId={selectedProjectId}
            variant="contable"
            templateHref="/api/finance/upload/accounting/template"
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
            templateHref="/api/finance/upload/sales/template"
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
            templateHref="/api/finance/upload/budgeted-sales/template"
          />
          <UploadHistory
            items={budgetedSalesHistory}
            title="Ultimas cargas de presupuesto"
            errorDownloadBasePath={null}
            countLabels={{ created: "Creados", updated: "Registros", rejected: "Errores" }}
          />
        </div>

        <div className="space-y-4">
          <ProcessingUploadCard
            title="Presupuesto de Gastos"
            description="Sube el presupuesto anual de gastos por grupo contable (Marketing, Inmobiliaria, Vacancia, etc.)."
            instruction=".xlsx -> hoja 'Presupuesto' con columnas Periodo, GRUPO 1, GRUPO 3, Valor UF"
            endpoint="/api/finance/upload/expense-budget"
            projectId={selectedProjectId}
            variant="expense-budget"
            templateHref="/api/finance/upload/expense-budget/template"
          />
          <UploadHistory
            items={expenseBudgetHistory}
            title="Ultimas cargas de PPTO gastos"
            errorDownloadBasePath={null}
            countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
          />
        </div>

        <div className="space-y-4">
          <ProcessingUploadCard
            title="Balances"
            description="Lee la hoja 'Data Balances' y carga el estado de situación financiera mensual en UF."
            instruction="CDG Mall Sport .xlsx -> hoja 'Data Balances'"
            endpoint="/api/finance/upload/balances"
            projectId={selectedProjectId}
            variant="balances"
            templateHref="/api/finance/upload/balances/template"
          />
          <UploadHistory
            items={balancesHistory}
            title="Ultimas cargas de balances"
            errorDownloadBasePath={null}
            countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
          />
        </div>

        <div className="space-y-4">
          <ProcessingUploadCard
            title="Banco"
            description="Lee la hoja 'Data Bco' y carga los movimientos bancarios mensuales."
            instruction="CDG Mall Sport .xlsx -> hoja 'Data Bco'"
            endpoint="/api/finance/upload/bank"
            projectId={selectedProjectId}
            variant="bank"
            templateHref="/api/finance/upload/bank/template"
          />
          <UploadHistory
            items={bankHistory}
            title="Ultimas cargas de banco"
            errorDownloadBasePath={null}
            countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
          />
        </div>
      </div>
    </main>
  );
}
