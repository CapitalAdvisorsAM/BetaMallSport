"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContractUploadReviewModal } from "@/components/upload/ContractUploadReviewModal";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { ContractManagerOption } from "@/types";
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
  contractReviewCatalogs?: {
    localCodes: string[];
    arrendatarios: ContractManagerOption[];
  };
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
    badgeClass: "border-emerald-200 bg-emerald-100 text-emerald-800"
  },
  UPDATED: {
    label: "ACTUALIZADO",
    rowClass: "bg-amber-50",
    badgeClass: "border-amber-200 bg-amber-100 text-amber-800"
  },
  UNCHANGED: {
    label: "SIN CAMBIO",
    rowClass: "bg-white opacity-60",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700"
  },
  ERROR: {
    label: "ERROR",
    rowClass: "bg-rose-50",
    badgeClass: "border-rose-200 bg-rose-100 text-rose-800"
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
  columns,
  contractReviewCatalogs
}: UploadSectionProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview<UploadRecord> | null>(null);
  const [cargaId, setCargaId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<ApplyReport | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [restoringPreview, setRestoringPreview] = useState(false);

  const isContractMode = tipo === "CONTRATOS";
  const storageKey = `rent-roll-contratos-preview:${proyectoId}`;

  const canApply = useMemo(() => {
    if (!preview) {
      return false;
    }
    return preview.summary.nuevo + preview.summary.actualizado > 0;
  }, [preview]);

  useEffect(() => {
    if (!isContractMode || preview || cargaId || restoringPreview) {
      return;
    }

    const savedCargaId = window.localStorage.getItem(storageKey);
    if (!savedCargaId) {
      return;
    }

    const controller = new AbortController();
    setRestoringPreview(true);

    fetch(`${previewEndpoint}?cargaId=${encodeURIComponent(savedCargaId)}`, {
      method: "GET",
      signal: controller.signal
    })
      .then(async (response) => {
        const rawPayload = (await response.json()) as unknown;
        const payload = parsePreviewResponse(rawPayload);
        if (!response.ok || !payload) {
          throw new Error(readErrorMessage(rawPayload, "No fue posible restaurar el preview guardado."));
        }
        setCargaId(payload.cargaId);
        setPreview(payload.preview);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        window.localStorage.removeItem(storageKey);
      })
      .finally(() => setRestoringPreview(false));

    return () => controller.abort();
  }, [cargaId, isContractMode, preview, previewEndpoint, restoringPreview, storageKey]);

  function onFileSelected(nextFile: File | null): void {
    setFile(nextFile);
    setPreview(null);
    setCargaId(null);
    setApplied(null);
    setReviewOpen(false);
    if (isContractMode) {
      window.localStorage.removeItem(storageKey);
    }
  }

  async function handlePreview(): Promise<void> {
    if (!file) {
      toast.warning("Selecciona un archivo antes de previsualizar.");
      return;
    }

    setPreviewing(true);
    setApplied(null);

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
      if (isContractMode) {
        window.localStorage.setItem(storageKey, payload.cargaId);
        setReviewOpen(true);
      }
      toast.success("Preview listo. Revisa fila por fila antes de aplicar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al previsualizar.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApply(): Promise<void> {
    if (!cargaId) {
      toast.warning("Primero debes generar un preview.");
      return;
    }

    setApplying(true);

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
      if (isContractMode) {
        window.localStorage.removeItem(storageKey);
        setReviewOpen(false);
      }
      toast.success("Carga aplicada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al aplicar la carga.");
    } finally {
      setApplying(false);
    }
  }

  const disabled = !canEdit || previewing || applying || restoringPreview;

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
        className={`rounded-md border-2 border-dashed p-5 transition-colors ${
          isDragging
            ? "border-brand-500 bg-brand-50"
            : file
              ? "border-emerald-400 bg-emerald-50/40"
              : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Seleccionar archivo
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={disabled}
              className="hidden"
              onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
            />
          </label>
          <span className={`text-sm ${file ? "font-medium text-emerald-700" : "text-slate-500"}`}>
            {file ? `âœ“ ${file.name}` : "Arrastra y suelta un archivo CSV/XLSX aqui."}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          disabled={disabled || !file}
          className="h-auto gap-2 px-4 py-2 text-sm"
        >
          {previewing ? (
            <>
              <Spinner className="text-slate-700" />
              Previsualizando...
            </>
          ) : (
            "Previsualizar"
          )}
        </Button>
        {isContractMode ? (
          <Button
            type="button"
            variant="default"
            onClick={() => setReviewOpen(true)}
            disabled={disabled || !preview || !cargaId}
            className="h-auto gap-2 px-4 py-2 text-sm font-semibold"
          >
            Revisar contratos
          </Button>
        ) : (
          <Button
            type="button"
            variant="default"
            onClick={handleApply}
            disabled={disabled || !preview || !cargaId || !canApply}
            className="h-auto gap-2 px-4 py-2 text-sm font-semibold"
          >
            {applying ? (
              <>
                <Spinner className="border-t-white text-white" />
                Aplicando...
              </>
            ) : (
              "Aplicar carga"
            )}
          </Button>
        )}
      </div>

      {!canEdit ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>âš </span>
          <span>Tu rol es de solo lectura para cargas.</span>
        </div>
      ) : null}
      {preview ? (
        <div className="space-y-3 rounded-md border border-slate-200 p-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-100 text-emerald-800">
              NUEVOS: {preview.summary.nuevo}
            </Badge>
            <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-100 text-amber-800">
              ACTUALIZADOS: {preview.summary.actualizado}
            </Badge>
            <Badge variant="outline" className="rounded-md border-slate-200 bg-slate-100 text-slate-600">
              SIN CAMBIO: {preview.summary.sinCambio}
            </Badge>
            {preview.summary.errores > 0 ? (
              <Badge variant="outline" className="rounded-md border-rose-200 bg-rose-100 text-rose-800">
                ERRORES: {preview.summary.errores}
              </Badge>
            ) : null}
          </div>

          {preview.warnings.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-amber-700">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <Table className="min-w-full divide-y-0 text-sm">
              <TableHeader className="bg-slate-50 text-slate-700">
                <TableRow>
                  <TableHead className="h-auto whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">
                    Fila
                  </TableHead>
                  <TableHead className="h-auto whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">
                    Estado
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={`h-auto whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700 ${column.className ?? ""}`}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                  <TableHead className="h-auto whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-700">
                    Error
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_tr]:border-slate-100">
                {preview.rows.map((row) => {
                  const status = statusMeta[row.status];
                  const changed = new Set((row.changedFields ?? []).map((field) => String(field)));

                  return (
                    <TableRow
                      key={`${row.rowNumber}-${row.status}`}
                      className={`${status.rowClass} hover:bg-inherit`}
                    >
                      <TableCell className="whitespace-nowrap px-3 py-2 text-slate-700">{row.rowNumber}</TableCell>
                      <TableCell className="whitespace-nowrap px-3 py-2">
                        <Badge variant="outline" className={`rounded-md px-2 py-1 ${status.badgeClass}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      {columns.map((column) => {
                        const value = row.data[column.key];
                        const renderedValue = column.render ? column.render(value, row) : String(value ?? "");
                        const isChanged = row.status === "UPDATED" && changed.has(column.key);

                        return (
                          <TableCell
                            key={column.key}
                            className={`whitespace-nowrap px-3 py-2 ${
                              isChanged ? "font-semibold text-slate-900" : "text-slate-700"
                            } ${column.className ?? ""}`}
                          >
                            {renderedValue}
                          </TableCell>
                        );
                      })}
                      <TableCell className="px-3 py-2">
                        {row.errorMessage ? (
                          <span className="flex items-start gap-1 text-rose-700">
                            <span className="mt-px shrink-0 text-xs">âš </span>
                            {row.errorMessage}
                          </span>
                        ) : (
                          <span className="text-slate-400">â€”</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {applied ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <span>âœ“</span> Carga aplicada exitosamente
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-emerald-700">
              <span className="font-semibold">{applied.created}</span> creados
            </span>
            <span className="text-amber-700">
              <span className="font-semibold">{applied.updated}</span> actualizados
            </span>
            <span className="text-slate-600">
              <span className="font-semibold">{applied.skipped}</span> sin cambio
            </span>
            {applied.rejected > 0 ? (
              <span className="text-rose-700">
                <span className="font-semibold">{applied.rejected}</span> rechazados
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {isContractMode && preview && cargaId ? (
        <ContractUploadReviewModal
          open={reviewOpen}
          preview={preview}
          cargaId={cargaId}
          previewEndpoint={previewEndpoint}
          canEdit={canEdit}
          applying={applying}
          canApply={canApply}
          proyectoId={proyectoId}
          localCodes={contractReviewCatalogs?.localCodes ?? []}
          arrendatarios={contractReviewCatalogs?.arrendatarios ?? []}
          onOpenChange={setReviewOpen}
          onApply={handleApply}
          onPreviewUpdated={(next) => {
            setCargaId(next.cargaId);
            setPreview(next.preview);
            window.localStorage.setItem(storageKey, next.cargaId);
          }}
        />
      ) : null}
    </section>
  );
}

