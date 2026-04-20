"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ContractForm,
  type ContractDraftPayload,
  type UploadReviewExtras
} from "@/components/contracts/ContractForm";
import {
  buildUploadReviewOptions,
  previewRowToUploadDraft,
  type UploadPreviewRowDraft,
  uploadDraftToPreviewData
} from "@/components/upload/contract-upload-review-mapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Spinner } from "@/components/ui/Spinner";
import type { ContractManagerOption } from "@/types";
import type {
  ContractReconciliation,
  PreviewRow,
  RowStatus,
  UploadPreview
} from "@/types/upload";

type UploadRecord = Record<string, unknown>;

type PreviewResponse = {
  cargaId: string;
  preview: UploadPreview<UploadRecord>;
  message?: string;
};

type ContractUploadReviewModalProps = {
  open: boolean;
  preview: UploadPreview<UploadRecord>;
  cargaId: string;
  previewEndpoint: string;
  canEdit: boolean;
  applying: boolean;
  canApply: boolean;
  proyectoId: string;
  localCodes: string[];
  arrendatarios: ContractManagerOption[];
  onOpenChange: (open: boolean) => void;
  onApply: () => Promise<void>;
  onPreviewUpdated: (next: { cargaId: string; preview: UploadPreview<UploadRecord> }) => void;
};

const statusMeta: Record<RowStatus, { label: string; badgeClass: string }> = {
  NEW: { label: "NUEVO", badgeClass: "border-emerald-200 bg-emerald-100 text-emerald-800" },
  UPDATED: { label: "ACTUALIZADO", badgeClass: "border-amber-200 bg-amber-100 text-amber-800" },
  UNCHANGED: { label: "SIN CAMBIO", badgeClass: "border-slate-200 bg-slate-100 text-slate-700" },
  ERROR: { label: "ERROR", badgeClass: "border-rose-200 bg-rose-100 text-rose-800" }
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function isPreviewResponse(value: unknown): value is PreviewResponse {
  return (
    isObject(value) &&
    typeof value.cargaId === "string" &&
    isObject(value.preview) &&
    Array.isArray(value.preview.rows) &&
    isObject(value.preview.summary) &&
    Array.isArray(value.preview.warnings) &&
    (value.preview.sourceFormat === undefined ||
      value.preview.sourceFormat === "template" ||
      value.preview.sourceFormat === "rent_roll") &&
    (value.preview.reconciliation === undefined || isContractReconciliation(value.preview.reconciliation))
  );
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (isObject(value) && typeof value.message === "string") {
    return value.message;
  }
  return fallback;
}

function signature(draft: ContractDraftPayload | null, extras: UploadReviewExtras | null): string {
  return JSON.stringify({ draft, extras });
}

export function ContractUploadReviewModal({
  open,
  preview,
  cargaId,
  previewEndpoint,
  canEdit,
  applying,
  canApply,
  proyectoId,
  localCodes,
  arrendatarios,
  onOpenChange,
  onApply,
  onPreviewUpdated
}: ContractUploadReviewModalProps): JSX.Element {
  const [reviewIndex, setReviewIndex] = useState(0);
  const [draft, setDraft] = useState<UploadPreviewRowDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savingRow, setSavingRow] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const baselineRef = useRef<string>("");

  const currentRow: PreviewRow<UploadRecord> | null =
    reviewIndex >= 0 && reviewIndex < preview.rows.length ? preview.rows[reviewIndex] : null;

  const reviewOptions = useMemo(
    () => buildUploadReviewOptions(localCodes, arrendatarios),
    [arrendatarios, localCodes]
  );

  useEffect(() => {
    if (reviewIndex < preview.rows.length) {
      return;
    }
    setReviewIndex(0);
  }, [preview.rows.length, reviewIndex]);

  useEffect(() => {
    if (!open || !currentRow) {
      return;
    }
    const mapped = previewRowToUploadDraft(currentRow, proyectoId);
    setDraft(mapped);
    baselineRef.current = signature(mapped.draft, mapped.extras);
    setDirty(false);
  }, [currentRow, open, proyectoId]);

  useEffect(() => {
    if (!draft) {
      return;
    }
    setDirty(signature(draft.draft, draft.extras) !== baselineRef.current);
  }, [draft]);

  const handleDraftChange = useCallback((nextDraft: ContractDraftPayload) => {
    setDraft((previous) => {
      if (!previous || previous.draft === nextDraft) {
        return previous;
      }
      return { ...previous, draft: nextDraft };
    });
  }, []);

  const handleExtrasChange = useCallback((nextExtras: UploadReviewExtras) => {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const sameExtras =
        previous.extras.numeroContrato === nextExtras.numeroContrato;
      if (sameExtras) {
        return previous;
      }
      return { ...previous, extras: nextExtras };
    });
  }, []);

  async function saveCurrentRow(): Promise<void> {
    if (!currentRow || !draft || !canEdit) {
      return;
    }

    setSavingRow(true);
    try {
      const response = await fetch(`${previewEndpoint}/row`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cargaId,
          rowNumber: currentRow.rowNumber,
          data: uploadDraftToPreviewData(draft.draft, draft.extras)
        })
      });

      const payload = (await response.json()) as unknown;
      if (!response.ok || !isPreviewResponse(payload)) {
        throw new Error(readErrorMessage(payload, "No fue posible guardar la fila."));
      }

      onPreviewUpdated({ cargaId: payload.cargaId, preview: payload.preview });
      const nextIndex = payload.preview.rows.findIndex((row) => row.rowNumber === currentRow.rowNumber);
      if (nextIndex >= 0) {
        setReviewIndex(nextIndex);
      }
      baselineRef.current = signature(draft.draft, draft.extras);
      setDirty(false);
      toast.success(`Fila ${currentRow.rowNumber} guardada y revalidada.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al guardar fila.");
    } finally {
      setSavingRow(false);
    }
  }

  function move(delta: number): void {
    if (dirty) {
      toast.warning("Guarda la fila actual antes de navegar.");
      return;
    }

    setReviewIndex((previous) => {
      const next = previous + delta;
      if (next < 0 || next >= preview.rows.length) {
        return previous;
      }
      return next;
    });
  }

  function closeWithGuard(): void {
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : closeWithGuard())}>
        <DialogContent className="flex max-h-[95vh] max-w-6xl flex-col gap-0 overflow-hidden bg-white p-0">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-4">
            <DialogTitle className="text-base font-semibold text-slate-900">
              Revision de contratos ({preview.rows.length} filas)
            </DialogTitle>
            <DialogDescription className="text-sm">
              Usa el mismo formulario de contratos para revisar y guardar cada fila antes de aplicar.
            </DialogDescription>
            {currentRow ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-700">
                  Fila {currentRow.rowNumber} ({reviewIndex + 1} de {preview.rows.length})
                </span>
                <Badge variant="outline" className={`rounded-md px-2 py-0.5 ${statusMeta[currentRow.status].badgeClass}`}>
                  {statusMeta[currentRow.status].label}
                </Badge>
                {dirty ? (
                  <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-100 text-amber-800">
                    Cambios sin guardar
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto bg-slate-50">
            {currentRow && draft ? (
              <div className="space-y-4 p-6">
                {currentRow.errorMessage ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {currentRow.errorMessage}
                  </div>
                ) : null}

                <ContractForm
                  key={`${currentRow.rowNumber}-${currentRow.status}`}
                  initialDraft={draft.draft}
                  proyectoId={proyectoId}
                  locals={reviewOptions.locals}
                  arrendatarios={reviewOptions.arrendatarios}
                  onSave={async () => undefined}
                  onCancel={() => undefined}
                  canEdit={canEdit}
                  batchMode
                  uploadReviewMode
                  uploadReviewExtras={draft.extras}
                  onUploadReviewExtrasChange={handleExtrasChange}
                  onDraftChange={handleDraftChange}
                  hideActions
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => move(-1)} disabled={reviewIndex === 0 || savingRow || applying}>
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => move(1)}
                disabled={reviewIndex >= preview.rows.length - 1 || savingRow || applying}
              >
                Siguiente
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="default" onClick={saveCurrentRow} disabled={!canEdit || !currentRow || savingRow || applying}>
                {savingRow ? (
                  <>
                    <Spinner className="border-t-white text-white" />
                    Guardando...
                  </>
                ) : (
                  "Guardar fila"
                )}
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={onApply}
                disabled={!canEdit || !canApply || dirty || savingRow || applying}
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={confirmClose}
        title="Cerrar sin guardar"
        description="Hay cambios sin guardar en esta fila. Si cierras, esos cambios locales se perderan. ¿Cerrar igual?"
        confirmLabel="Cerrar igual"
        onConfirm={() => {
          setConfirmClose(false);
          onOpenChange(false);
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  );
}
