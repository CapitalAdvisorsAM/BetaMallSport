"use client";

import { useMemo, useState } from "react";
import type { RentRollPreviewPayload } from "@/types";
import { cn } from "@/lib/utils";

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
  const [loadingAction, setLoadingAction] = useState<"preview" | "apply" | null>(null);
  const [cargaId, setCargaId] = useState<string | null>(initialCargaId ?? null);
  const [payload, setPayload] = useState<RentRollPreviewPayload | null>(initialPayload ?? null);
  const [applyReport, setApplyReport] = useState<ApplyReport | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  const hasErrors = useMemo(() => {
    if (!payload) {
      return false;
    }
    return payload.errors.length > 0 || (payload.report?.rejectedRows.length ?? 0) > 0;
  }, [payload]);

  async function handlePreview(): Promise<void> {
    if (!file) {
      setMessageType("error");
      setMessage("Selecciona un archivo antes de previsualizar.");
      return;
    }
    setLoading(true);
    setLoadingAction("preview");
    setMessage(null);
    setMessageType(null);
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
      setMessageType("success");
      setMessage("Previsualizacion generada correctamente.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Error inesperado en previsualizacion.");
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleApply(): Promise<void> {
    if (!cargaId) {
      setMessageType("error");
      setMessage("Primero debes previsualizar una carga.");
      return;
    }
    setLoading(true);
    setLoadingAction("apply");
    setMessage(null);
    setMessageType(null);
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
      setMessageType("success");
      setMessage("Carga aplicada.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Error inesperado al aplicar.");
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  }

  const currentStep = applyReport ? 3 : payload ? 3 : file ? 2 : 1;

  return (
    <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Cargar Rent Roll (CSV/XLSX)</h3>
      <ol className="mb-4 flex items-center gap-0">
        {[
          { n: 1, label: "Seleccionar" },
          { n: 2, label: "Previsualizar" },
          { n: 3, label: "Aplicar" }
        ].map(({ n, label }, i) => (
          <li key={n} className="flex items-center">
            {i > 0 ? (
              <div className={cn("h-px w-8 flex-shrink-0", currentStep > i ? "bg-brand-500" : "bg-slate-200")} />
            ) : null}
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                  currentStep > n
                    ? "bg-emerald-500 text-white"
                    : currentStep === n
                      ? "bg-brand-500 text-white"
                      : "bg-slate-100 text-slate-400"
                )}
              >
                {currentStep > n ? "✓" : n}
              </span>
              <span className={cn("text-[10px] font-medium", currentStep === n ? "text-brand-700" : "text-slate-400")}>
                {label}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={!canEdit || loading}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPayload(null);
            setApplyReport(null);
            setCargaId(null);
            setMessage(null);
            setMessageType(null);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handlePreview}
          disabled={!canEdit || loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingAction === "preview" ? (
            <>
              <svg className="mr-1.5 inline h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Previsualizando…
            </>
          ) : (
            "Previsualizar"
          )}
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!canEdit || loading || !cargaId}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingAction === "apply" ? (
            <>
              <svg className="mr-1.5 inline h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Aplicando…
            </>
          ) : (
            "Aplicar"
          )}
        </button>
      </div>

      {!canEdit ? (
        <p className="text-sm text-amber-700">Tu rol es de solo lectura para cargas.</p>
      ) : null}
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={cn("text-sm", messageType === "error" ? "text-rose-600" : "text-emerald-700")}
        >
          {message}
        </p>
      ) : null}

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
