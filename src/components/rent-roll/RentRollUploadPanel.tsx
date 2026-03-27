"use client";

import { useMemo, useState } from "react";
import type { RentRollPreviewPayload } from "@/types";

type RentRollUploadPanelProps = {
  proyectoId: string;
  initialCargaId?: string;
  initialPayload?: RentRollPreviewPayload | null;
  canEdit: boolean;
};

type ApplyReport = {
  created: number;
  updated: number;
  rejected: number;
};

export function RentRollUploadPanel({
  proyectoId,
  initialCargaId,
  initialPayload,
  canEdit
}: RentRollUploadPanelProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [cargaId, setCargaId] = useState<string | null>(initialCargaId ?? null);
  const [payload, setPayload] = useState<RentRollPreviewPayload | null>(initialPayload ?? null);
  const [applyReport, setApplyReport] = useState<ApplyReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hasErrors = useMemo(() => {
    if (!payload) {
      return false;
    }
    return payload.errors.length > 0 || (payload.report?.rejectedRows.length ?? 0) > 0;
  }, [payload]);

  async function handlePreview(): Promise<void> {
    if (!file) {
      setMessage("Selecciona un archivo antes de previsualizar.");
      return;
    }
    setLoading(true);
    setMessage(null);
    setApplyReport(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("proyectoId", proyectoId);

      const response = await fetch("/api/rent-roll/upload/preview", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as {
        cargaId?: string;
        preview?: RentRollPreviewPayload;
        message?: string;
      };
      if (!response.ok || !data.cargaId || !data.preview) {
        throw new Error(data.message ?? "No se pudo generar la previsualizacion.");
      }
      setCargaId(data.cargaId);
      setPayload(data.preview);
      setMessage("Previsualizacion generada correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado en previsualizacion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(): Promise<void> {
    if (!cargaId) {
      setMessage("Primero debes previsualizar una carga.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rent-roll/upload/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cargaId })
      });
      const data = (await response.json()) as {
        report?: ApplyReport;
        message?: string;
      };
      if (!response.ok || !data.report) {
        throw new Error(data.message ?? "No se pudo aplicar la carga.");
      }
      setApplyReport(data.report);
      setMessage("Carga aplicada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al aplicar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Cargar Rent Roll (CSV/XLSX)</h3>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={!canEdit || loading}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handlePreview}
          disabled={!canEdit || loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previsualizar
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!canEdit || loading || !cargaId}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>

      {!canEdit ? (
        <p className="text-sm text-amber-700">Tu rol es de solo lectura para cargas.</p>
      ) : null}
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      {payload ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Resumen previsualizacion</h4>
          <p className="mt-2 text-sm text-slate-700">
            Total: {payload.summary.totalRows} | Validas: {payload.summary.validRows} | Errores:{" "}
            {payload.summary.errorRows}
          </p>
          {payload.warnings.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-700">
              {payload.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {hasErrors && cargaId ? (
            <a
              className="mt-3 inline-block text-sm font-medium text-brand-700 underline"
              href={`/api/rent-roll/upload/errors?cargaId=${cargaId}`}
            >
              Descargar detalle de errores (CSV)
            </a>
          ) : null}
        </div>
      ) : null}

      {applyReport ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Resultado carga: creados {applyReport.created}, actualizados {applyReport.updated}, rechazados{" "}
          {applyReport.rejected}.
        </div>
      ) : null}
    </section>
  );
}
