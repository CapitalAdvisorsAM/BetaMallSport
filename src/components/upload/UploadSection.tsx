"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { type ColumnDef as TanstackColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContractUploadReviewModal } from "@/components/upload/ContractUploadReviewModal";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/Spinner";
import { useDataTable } from "@/hooks/useDataTable";
import type { ContractManagerOption } from "@/types";
import type {
  ApplyReport,
  ContractReconciliation,
  PreviewRow,
  RowStatus,
  UploadPreview
} from "@/types/upload";

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

const reconciliationKindMeta: Record<
  ContractReconciliation["items"][number]["kind"],
  { label: string; badgeClass: string }
> = {
  matched_by_natural_key: {
    label: "Match natural",
    badgeClass: "border-sky-200 bg-sky-100 text-sky-800"
  },
  creatable_contract: {
    label: "Creable",
    badgeClass: "border-emerald-200 bg-emerald-100 text-emerald-800"
  },
  vacancy_confirmed: {
    label: "Vacante OK",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700"
  },
  vacancy_conflict: {
    label: "Vacante conflicto",
    badgeClass: "border-amber-200 bg-amber-100 text-amber-800"
  },
  blocked_row: {
    label: "Bloqueada",
    badgeClass: "border-rose-200 bg-rose-100 text-rose-800"
  },
  ref_ca_mismatch: {
    label: "REF CA",
    badgeClass: "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800"
  },
  skipped_row: {
    label: "Omitida",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700"
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

function isContractReconciliation(value: unknown): value is ContractReconciliation {
  return (
    isObject(value) &&
    isObject(value.summary) &&
    typeof value.summary.matchedByNaturalKey === "number" &&
    typeof value.summary.creatableContracts === "number" &&
    typeof value.summary.vacancyConfirmed === "number" &&
    typeof value.summary.vacancyConflicts === "number" &&
    typeof value.summary.blockedRows === "number" &&
    typeof value.summary.refCaMismatches === "number" &&
    typeof value.summary.skippedRows === "number" &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isObject(item) &&
        typeof item.rowNumber === "number" &&
        typeof item.kind === "string" &&
        (item.localCodigo === null || typeof item.localCodigo === "string") &&
        (item.arrendatarioNombre === null || typeof item.arrendatarioNombre === "string") &&
        (item.refCa === null || typeof item.refCa === "string") &&
        typeof item.message === "string"
    )
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
    value.warnings.every((item) => typeof item === "string") &&
    (value.sourceFormat === undefined ||
      value.sourceFormat === "template" ||
      value.sourceFormat === "rent_roll") &&
    (value.reconciliation === undefined || isContractReconciliation(value.reconciliation))
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
  const previewColumns = useMemo<TanstackColumnDef<PreviewRow<UploadRecord>, unknown>[]>(
    () => [
      {
        accessorKey: "rowNumber",
        header: "Fila",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap text-slate-700">{row.original.rowNumber}</span>
      },
      {
        accessorKey: "status",
        header: "Estado",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: {
          filterType: "enum",
          filterOptions: Object.keys(statusMeta),
          align: "center"
        },
        cell: ({ row }) => (
          <Badge variant="outline" className={`rounded-md px-2 py-1 ${statusMeta[row.original.status].badgeClass}`}>
            {statusMeta[row.original.status].label}
          </Badge>
        )
      },
      ...columns.map((column) => {
        const align = column.className?.includes("text-right")
          ? "right"
          : column.className?.includes("text-center")
            ? "center"
            : "left";

        return {
          id: `data_${column.key}`,
          accessorFn: (row: PreviewRow<UploadRecord>) => row.data[column.key],
          header: column.label,
          filterFn: "includesString",
          meta: { filterType: "string", align },
          cell: ({ row }) => {
            const value = row.original.data[column.key];
            const renderedValue = column.render ? column.render(value, row.original) : String(value ?? "");
            const changed = new Set((row.original.changedFields ?? []).map((field) => String(field)));
            const isChanged = row.original.status === "UPDATED" && changed.has(column.key);

            return (
              <span className={isChanged ? "font-semibold text-slate-900" : "text-slate-700"}>
                {renderedValue}
              </span>
            );
          }
        } satisfies TanstackColumnDef<PreviewRow<UploadRecord>, unknown>;
      }),
      {
        id: "errorMessage",
        accessorFn: (row) => row.errorMessage ?? "",
        header: "Error",
        filterFn: "includesString",
        cell: ({ row }) =>
          row.original.errorMessage ? (
            <span className="flex items-start gap-1 text-rose-700">
              <span className="mt-px shrink-0 text-xs">!</span>
              {row.original.errorMessage}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )
      }
    ],
    [columns]
  );
  const { table: previewTable } = useDataTable(preview?.rows ?? [], previewColumns);

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
          href={`${templateEndpoint}?projectId=${encodeURIComponent(proyectoId)}`}
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
            {preview.sourceFormat === "rent_roll" ? (
              <Badge variant="outline" className="rounded-md border-sky-200 bg-sky-100 text-sky-800">
                FORMATO: RENT ROLL
              </Badge>
            ) : null}
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

          {preview.reconciliation ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-md border-sky-200 bg-sky-100 text-sky-800">
                  MATCH CLAVE NATURAL: {preview.reconciliation.summary.matchedByNaturalKey}
                </Badge>
                <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-100 text-emerald-800">
                  CREABLES: {preview.reconciliation.summary.creatableContracts}
                </Badge>
                <Badge variant="outline" className="rounded-md border-slate-200 bg-slate-100 text-slate-700">
                  VACANTES OK: {preview.reconciliation.summary.vacancyConfirmed}
                </Badge>
                <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-100 text-amber-800">
                  VACANTES CONFLICTO: {preview.reconciliation.summary.vacancyConflicts}
                </Badge>
                {preview.reconciliation.summary.blockedRows > 0 ? (
                  <Badge variant="outline" className="rounded-md border-rose-200 bg-rose-100 text-rose-800">
                    BLOQUEADAS: {preview.reconciliation.summary.blockedRows}
                  </Badge>
                ) : null}
                {preview.reconciliation.summary.refCaMismatches > 0 ? (
                  <Badge variant="outline" className="rounded-md border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800">
                    REF CA DISTINTO: {preview.reconciliation.summary.refCaMismatches}
                  </Badge>
                ) : null}
                {preview.reconciliation.summary.skippedRows > 0 ? (
                  <Badge variant="outline" className="rounded-md border-slate-200 bg-slate-100 text-slate-700">
                    OMITIDAS: {preview.reconciliation.summary.skippedRows}
                  </Badge>
                ) : null}
              </div>

              {preview.reconciliation.items.length > 0 ? (
                <div className="space-y-2">
                  {preview.reconciliation.items.slice(0, 8).map((item) => {
                    const meta = reconciliationKindMeta[item.kind];
                    const title = [
                      `Fila ${item.rowNumber}`,
                      item.localCodigo ? `Local ${item.localCodigo}` : null,
                      item.arrendatarioNombre ?? null
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div
                        key={`${item.kind}-${item.rowNumber}-${item.localCodigo ?? "na"}`}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline" className={`rounded-md px-2 py-0.5 ${meta.badgeClass}`}>
                            {meta.label}
                          </Badge>
                          <span className="font-medium text-slate-800">{title}</span>
                          {item.refCa ? <span className="text-slate-500">REF CA {item.refCa}</span> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                      </div>
                    );
                  })}
                  {preview.reconciliation.items.length > 8 ? (
                    <p className="text-xs text-slate-500">
                      Mostrando 8 de {preview.reconciliation.items.length} elementos de reconciliacion.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <DataTable
              table={previewTable}
              density="compact"
              getRowClassName={(row) => `${statusMeta[row.original.status].rowClass} hover:bg-inherit`}
            />
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

