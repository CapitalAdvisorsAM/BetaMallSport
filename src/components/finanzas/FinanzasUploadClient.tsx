"use client";

import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { CargaHistorial } from "@/components/upload/CargaHistorial";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import type { ProjectOption } from "@/types/finanzas";
import type { UploadHistoryItem } from "@/lib/upload/history";

type FinanzasUploadClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  historialContable: UploadHistoryItem[];
  historialVentas: UploadHistoryItem[];
};

export function FinanzasUploadClient({
  projects,
  selectedProjectId,
  historialContable,
  historialVentas
}: FinanzasUploadClientProps): JSX.Element {
  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Cargar Datos"
        description='Sube el archivo CDG (.xlsx) para procesar las hojas "Data Contable" y "Data Ventas".'
        projects={projects}
        selectedProjectId={selectedProjectId}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <ProcessingUploadCard
            title="Datos Contables"
            description="Lee la hoja 'Data Contable' del archivo CDG y filtra Ce.coste = 'Real'."
            instruction="CDG Mall Sport .xlsx -> hoja 'Data Contable'"
            endpoint="/api/finanzas/upload/contable"
            projectId={selectedProjectId}
            variant="contable"
          />
          <CargaHistorial
            items={historialContable}
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
            endpoint="/api/finanzas/upload/ventas"
            projectId={selectedProjectId}
            variant="ventas"
          />
          <CargaHistorial
            items={historialVentas}
            title="Ultimas cargas de ventas"
            errorDownloadBasePath={null}
            countLabels={{ created: "Creados", updated: "Registros", rejected: "Errores" }}
          />
        </div>
      </div>
    </main>
  );
}
