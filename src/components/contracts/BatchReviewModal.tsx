"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { ContractForm, type ContractDraftPayload } from "@/components/contracts/ContractForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { ContractFormPayload, ContractManagerOption } from "@/types";

type DraftStatus = "pending" | "approved" | "skipped" | "error";

export type BatchDraft = {
  id: string;
  source: "pdf" | "xlsx";
  label: string;
  payload: ContractDraftPayload;
};

type BatchReviewModalProps = {
  open: boolean;
  drafts: BatchDraft[];
  proyectoId: string;
  locals: ContractManagerOption[];
  arrendatarios: ContractManagerOption[];
  canEdit: boolean;
  onApprove: (payload: ContractFormPayload) => Promise<void>;
  onClose: () => void;
};

export function BatchReviewModal({
  open,
  drafts,
  proyectoId,
  locals,
  arrendatarios,
  canEdit,
  onApprove,
  onClose
}: BatchReviewModalProps): JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, DraftStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDone = currentIndex >= drafts.length;
  const currentDraft = isDone ? null : drafts[currentIndex];

  const approved = Object.values(statuses).filter((s) => s === "approved").length;
  const skipped = Object.values(statuses).filter((s) => s === "skipped" || s === "error").length;
  const withErrors = Object.keys(errors).length;

  function skip(): void {
    if (!currentDraft) return;
    setStatuses((prev) => ({ ...prev, [currentDraft.id]: "skipped" }));
    setCurrentIndex((prev) => prev + 1);
  }

  async function handleApprove(payload: ContractFormPayload): Promise<void> {
    if (!currentDraft) return;
    try {
      await onApprove(payload);
      setStatuses((prev) => ({ ...prev, [currentDraft.id]: "approved" }));
      setCurrentIndex((prev) => prev + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar.";
      setStatuses((prev) => ({ ...prev, [currentDraft.id]: "error" }));
      setErrors((prev) => ({ ...prev, [currentDraft.id]: msg }));
      // re-throw so ContractForm can catch it and show toast
      throw err;
    }
  }

  function handleClose(): void {
    setCurrentIndex(0);
    setStatuses({});
    setErrors({});
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent className="flex max-h-[95vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        {/* Sticky header */}
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {isDone
                ? "Resumen de carga"
                : `Revisión ${currentIndex + 1} de ${drafts.length}`}
            </DialogTitle>
            {!isDone && drafts.length > 0 ? (
              <div className="flex items-center gap-1">
                {drafts.map((d, i) => {
                  const s = statuses[d.id];
                  return (
                    <span
                      key={d.id}
                      title={d.label}
                      className={`block h-2 w-2 rounded-full transition-colors ${
                        s === "approved"
                          ? "bg-emerald-500"
                          : s === "skipped" || s === "error"
                            ? "bg-slate-300"
                            : i === currentIndex
                              ? "bg-brand-500"
                              : "bg-slate-200"
                      }`}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
          {!isDone ? (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${(currentIndex / drafts.length) * 100}%` }}
              />
            </div>
          ) : null}
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {isDone ? (
            <div className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-700">{approved}</p>
                  <p className="text-sm text-emerald-600">Creados</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-3xl font-bold text-slate-500">{skipped}</p>
                  <p className="text-sm text-slate-500">Omitidos</p>
                </div>
                <div
                  className={`rounded-md border p-4 text-center ${
                    withErrors > 0
                      ? "border-rose-200 bg-rose-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p
                    className={`text-3xl font-bold ${
                      withErrors > 0 ? "text-rose-600" : "text-slate-400"
                    }`}
                  >
                    {withErrors}
                  </p>
                  <p className={`text-sm ${withErrors > 0 ? "text-rose-500" : "text-slate-400"}`}>
                    Con error
                  </p>
                </div>
              </div>

              {withErrors > 0 ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm">
                  <p className="mb-2 font-semibold text-rose-800">Contratos con error al guardar:</p>
                  <ul className="space-y-1">
                    {drafts
                      .filter((d) => errors[d.id])
                      .map((d) => (
                        <li key={d.id} className="text-rose-700">
                          <span className="font-medium">{d.label}:</span> {errors[d.id]}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex justify-end pt-2">
                <Button onClick={handleClose} className="rounded-full px-6">
                  Cerrar
                </Button>
              </div>
            </div>
          ) : currentDraft ? (
            <div>
              {/* Source indicator bar */}
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-2.5 text-sm text-slate-500">
                {currentDraft.source === "pdf" ? (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                )}
                <span className="truncate font-medium">{currentDraft.label}</span>
                {statuses[currentDraft.id] === "error" ? (
                  <span className="ml-auto shrink-0 font-medium text-rose-600">
                    Error — corrige y vuelve a intentar, o haz clic en Omitir
                  </span>
                ) : null}
              </div>

              <ContractForm
                key={currentDraft.id}
                initialDraft={currentDraft.payload}
                proyectoId={proyectoId}
                locals={locals}
                arrendatarios={arrendatarios}
                onSave={handleApprove}
                onCancel={skip}
                canEdit={canEdit}
                batchMode
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
