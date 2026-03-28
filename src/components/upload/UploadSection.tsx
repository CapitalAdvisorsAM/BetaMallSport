"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ApplyReport, PreviewRow, RowStatus, UploadPreview } from "@/types/upload";

type UploadRecord = Record<string, unknown>;

export type ColumnDef = {
  key: string;
  label: string;
  className?: string;
  render?: (value: unknown, row: PreviewRow<UploadRecord>) => ReactNode;
};

type UploadSectionProps = {
  tipo: "LOCALES" | "ARRENDATARIOS" | "CONTRATOS";
  proyectoId: string;
  canEdit: boolean;
  previewEndpoint: string;
  applyEndpoint: string;
  templateEndpoint: string;
  columns: ColumnDef[];
};

type PreviewResponse = {
  cargaId: string;
  preview: UploadPreview<UploadRecord>;
  message?: string;
};

type ApplyResponse = {
  report: ApplyReport;
  message?: string;
};

const statusMeta: Record<RowStatus, { label: string; rowClass: string; badgeClass: string }> = {
  NEW: {
    label: "NUEVO",
    rowClass: "bg-emerald-50",
    badgeClass: "bg-emerald-100 text-emerald-800"
  },
  UPDATED: {
    label: "ACTUALIZADO",
    rowClass: "bg-amber-50",
    badgeClass: "bg-amber-100 text-amber-800"
  },
  UNCHANGED: {
    label: "SIN CAMBIO",
    rowClass: "bg-white opacity-60",
    badgeClass: "bg-slate-100 text-slate-700"
  },
  ERROR: {
    label: "ERROR",
    rowClass: "bg-rose-50",
    badgeClass: "bg-rose-100 text-rose-800"
  }
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRowStatus(value: unknown): value is RowStatus {
  return value === "NEW" || value === "UPDATED" || value === "UNCHANGED" || value === "ERROR";
}

function isUploadIssueArray(value: unknown): value is ApplyReport["rejectedRows"] {
  return (
    Array.isArray(value) &&
    value.every((item) => isObject(item) && typeof item.rowNumber === "number" && typeof item.message === "string")
  );
}

function isApplyReport(value: unknown): value is ApplyReport {
  return (
    isObject(value) &&
    typeof value.created === "number" &&
    typeof value.updated === "number" &&
    typeof value.skipped === "number" &&
    typeof value.rejected === "number" &&
    isUploadIssueArray(value.rejectedRows)
  );
}

function isPreviewRow(value: unknown): value is PreviewRow<UploadRecord> {
  return (
    isObject(value) &&
    typeof value.rowNumber === "number" &&
    isRowStatus(value.status) &&
    isObject(value.data) &&
    (value.changedFields === undefined ||
      (Array.isArray(value.changedFields) && value.changedFields.every((item) => typeof item === "string"))) &&
    (value.errorMessage === undefined || typeof value.errorMessage === "string")
  );
}

function isUploadPreview(value: unknown): value is UploadPreview<UploadRecord> {
  return (
    isObject(value) &&
    Array.isArray(value.rows) &&
    value.rows.every(isPreviewRow) &&
    isObject(value.summary) &&
    typeof value.summary.total === "number" &&
    typeof value.summary.nuevo === "number" &&
    typeof value.summary.actualizado === "number" &&
    typeof value.summary.sinCambio === "number" &&
    typeof value.summary.errores === "number" &&
    Array.isArray(value.warnings) &&
    value.warnings.every((item) => typeof item === "string")
  );
}

function parsePreviewResponse(value: unknown): PreviewResponse | null {
  if (!isObject(value)) {
    return null;
  }
  if (typeof value.cargaId !== "string" || !isUploadPreview(value.preview)) {
    return null;
  }
  if (value.message !== undefined && typeof value.message !== "string") {
    return null;
  }
  return {
    cargaId: value.cargaId,
    preview: value.preview,
    message: value.message
  };
}

function parseApplyResponse(value: unknown): ApplyResponse | null {
  if (!isObject(value) || !isApplyReport(value.report)) {
    return null;
  }
  if (value.message !== undefined && typeof value.message !== "string") {
    return null;
  }
  return {
    report: value.report,
    message: value.message
  };
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (isObject(value) && typeof value.message === "string") {
    return value.message;
  }
  return fallback;
}

export function UploadSection({
  tipo,
  proyectoId,
  canEdit,
  previewEndpoint,
  applyEndpoint,
  templateEndpoint,
  columns
}: UploadSectionProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview<UploadRecord> | null>(null);
  const [cargaId, setCargaId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<ApplyReport | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canApply = useMemo(() => {
    if (!preview) {
      return false;
    }
    return preview.summary.nuevo + preview.summary.actualizado > 0;
  }, [preview]);

  function onFileSelected(nextFile: File | null): void {
    setFile(nextFile);
    setPreview(null);
    setCargaId(null);
    setApplied(null);
    setMessage(null);
  }

  async function handlePreview(): Promise<void> {
    if (!file) {
      setMessage("Selecciona un archivo antes de previsualizar.");
      return;
    }

    setPreviewing(true);
    setApplied(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("proyectoId", proyectoId);

      const response = await fetch(previewEndpoint, { method: "POST", body: formData });
      const rawPayload = (await response.json()) as unknown;
      const payload = parsePreviewResponse(rawPayload);

      if (!response.ok || !payload) {
        throw new Error(readErrorMessage(rawPayload, "No se pudo generar la previsualizacion."));
      }

      setCargaId(payload.cargaId);
      setPreview(payload.preview);
      setMessage("Preview listo. Revisa fila por fila antes de aplicar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al previsualizar.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApply(): Promise<void> {
    if (!cargaId) {
      setMessage("Primero debes generar un preview.");
      return;
    }

    setApplying(true);
    setMessage(null);

    try {
      const response = await fetch(applyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cargaId })
      });
      const rawPayload = (await response.json()) as unknown;
      const payload = parseApplyResponse(rawPayload);

      if (!response.ok || !payload) {
        throw new Error(readErrorMessage(rawPayload, "No fue posible aplicar la carga."));
      }

      setApplied(payload.report);
      setMessage("Carga aplicada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al aplicar la carga.");
    } finally {
      setApplying(false);
    }
  }

  const disabled = !canEdit || previewing || applying;

  return (
    <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-brand-700">Carga {tipo.toLowerCase()}</h3>
        <a
          href={`${templateEndpoint}?proyectoId=${encodeURIComponent(proyectoId)}`}
          className="text-sm font-medium text-brand-700 underline"
        >
          Descargar plantilla
        </a>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) {
            onFileSelected(event.dataTransfer.files?.[0] ?? null);
          }
        }}
        className={`rounded-md border border-dashed p-4 transition ${
          isDragging ? "border-brand-700 bg-brand-50/40" : "border-slate-300"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">
            Seleccionar archivo
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={disabled}
              className="hidden"
              onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
            />
          </label>
          <span className="text-sm text-slate-600">
            {file ? file.name : "Arrastra y suelta un archivo CSV/XLSX aqui."}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={disabled || !file}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {previewing ? "Previsualizando..." : "Previsualizar"}
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled || !preview || !cargaId || !canApply}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {applying ? "Aplicando..." : "Aplicar carga"}
        </button>
      </div>

      {!canEdit ? (
        <p className="text-sm text-amber-700">Tu rol es de solo lectura para cargas.</p>
      ) : null}
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      {preview ? (
        <div className="space-y-3 rounded-md border border-slate-200 p-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">
              NUEVOS: {preview.summary.nuevo}
            </span>
            <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800">
              ACTUALIZADOS: {preview.summary.actualizado}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
              SIN CAMBIO: {preview.summary.sinCambio}
            </span>
            <span className="rounded-md bg-rose-100 px-2 py-1 text-rose-800">
              ERRORES: {preview.summary.errores}
            </span>
          </div>

          {preview.warnings.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-amber-700">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">Fila</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">
                    Estado
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={`whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700 ${column.className ?? ""}`}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row) => {
                  const status = statusMeta[row.status];
                  const changed = new Set((row.changedFields ?? []).map((field) => String(field)));

                  return (
                    <tr key={`${row.rowNumber}-${row.status}`} className={status.rowClass}>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.rowNumber}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status.badgeClass}`}>
                          {status.label}
                        </span>
                      </td>
                      {columns.map((column) => {
                        const value = row.data[column.key];
                        const renderedValue = column.render ? column.render(value, row) : String(value ?? "");
                        const isChanged = row.status === "UPDATED" && changed.has(column.key);

                        return (
                          <td
                            key={column.key}
                            className={`whitespace-nowrap px-3 py-2 ${
                              isChanged ? "font-semibold text-slate-900" : "text-slate-700"
                            } ${column.className ?? ""}`}
                          >
                            {renderedValue}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-rose-700">{row.errorMessage ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {applied ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Resultado: creados {applied.created}, actualizados {applied.updated}, sin cambio {applied.skipped},
          rechazados {applied.rejected}.
        </div>
      ) : null}
    </section>
  );
}
