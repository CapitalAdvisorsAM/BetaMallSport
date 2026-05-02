"use client";

import { useState } from "react";
import type { UploadHistoryItem } from "@/lib/upload/history";
import { ProcessingUploadCard } from "@/components/upload/ProcessingUploadCard";
import { UploadHistory } from "@/components/upload/UploadHistory";
import { AccountingRecordsTable } from "@/components/real/AccountingRecordsTable";
import { cn } from "@/lib/utils";

type Tab = "cargar" | "ver";

type Props = {
  projectId: string;
  uploadHistory: UploadHistoryItem[];
};

export function AccountingImportsTabsClient({ projectId, uploadHistory }: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>("cargar");

  return (
    <div className="space-y-4">
      {/* ── Tab bar ── */}
      <div className="flex gap-1 border-b border-surface-200">
        {(
          [
            { id: "cargar", label: "Cargar datos" },
            { id: "ver", label: "Ver y corregir" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === id
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Cargar ── */}
      {tab === "cargar" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          <ProcessingUploadCard
            title="Datos Contables"
            description="Lee la hoja 'Data Contable' del archivo CDG y filtra Ce.coste = 'Real'."
            instruction="CDG Mall Sport .xlsx → hoja 'Data Contable'"
            endpoint="/api/real/upload/accounting"
            projectId={projectId}
            variant="contable"
            templateHref="/api/real/upload/accounting/template"
          />
          <UploadHistory
            items={uploadHistory}
            title="Últimas cargas contables"
            errorDownloadBasePath={null}
            countLabels={{ created: "Registros", updated: "Actualizados", rejected: "Errores" }}
          />
        </div>
      )}

      {/* ── Tab: Ver y corregir ── */}
      {tab === "ver" && (
        <div className="rounded-md border border-surface-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="overline text-brand-700">Data Contable — registros individuales</h3>
            <p className="mt-1 text-sm text-slate-500">
              Haz clic en cualquier valor UF para editarlo directamente.
              Los registros editados se marcan en{" "}
              <span className="font-semibold text-amber-700">ámbar</span>.
              Al re-subir un archivo que afecte períodos con correcciones,
              el sistema te pedirá confirmación antes de sobrescribirlas.
            </p>
          </div>
          <AccountingRecordsTable projectId={projectId} />
        </div>
      )}
    </div>
  );
}
