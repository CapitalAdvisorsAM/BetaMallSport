"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { BatchReviewModal, type BatchDraft } from "@/components/contracts/BatchReviewModal";
import { ContractEditModal } from "@/components/contracts/ContractEditModal";
import { ContractForm, extractionToDraft } from "@/components/contracts/ContractForm";
import type { ContractDraftPayload } from "@/components/contracts/ContractForm";
import { ContractList } from "@/components/contracts/ContractList";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Spinner } from "@/components/ui/Spinner";
import { useContractApi } from "@/hooks/useContractApi";
import type {
  ContractExtractionResponse,
  ContractFormPayload,
  ContractManagerListItem,
  ContractManagerOption
} from "@/types";

type ContractManagerProps = {
  proyectoId: string;
  canEdit: boolean;
  locals: ContractManagerOption[];
  arrendatarios: ContractManagerOption[];
  contracts: ContractManagerListItem[];
  nextCursor?: string;
};

type ExtractionApiResponse = ContractExtractionResponse & { message?: string };

type BatchParseApiContract = ContractDraftPayload & {
  localCodigo: string;
  arrendatarioNombre: string;
};

export function ContractManager({
  proyectoId,
  canEdit,
  locals,
  arrendatarios,
  contracts,
  nextCursor
}: ContractManagerProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCursor = searchParams.get("cursor");
  const [, startTransitionFn] = useTransition();
  const [contractList, setContractList] = useState<ContractManagerListItem[]>(contracts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [batchDrafts, setBatchDrafts] = useState<BatchDraft[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchExtracting, setBatchExtracting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);

  const {
    saveContract: saveContractRequest,
    deleteContract: deleteContractRequest
  } = useContractApi();

  useEffect(() => {
    setContractList((previous) => {
      if (!currentCursor) {
        return contracts;
      }

      const byId = new Map(previous.map((item) => [item.id, item]));
      for (const item of contracts) {
        byId.set(item.id, item);
      }
      return Array.from(byId.values());
    });
  }, [contracts, currentCursor]);

  const selectedContract = useMemo(
    () => contractList.find((contract) => contract.id === selectedId) ?? null,
    [contractList, selectedId]
  );

  async function saveContract(payload: ContractFormPayload): Promise<void> {
    await saveContractRequest(payload, undefined);
    toast.success("Contrato guardado correctamente.");
    startTransitionFn(() => {
      router.refresh();
    });
  }

  async function saveEditedContract(payload: ContractFormPayload): Promise<void> {
    await saveContractRequest(payload, selectedId ?? undefined);
    toast.success("Contrato actualizado correctamente.");
    setEditModalOpen(false);
    setSelectedId(null);
    startTransitionFn(() => {
      router.refresh();
    });
  }

  function openEditModal(id: string): void {
    setSelectedId(id);
    setEditModalOpen(true);
  }

  function closeEditModal(): void {
    setEditModalOpen(false);
    setSelectedId(null);
  }

  async function saveContractBatch(payload: ContractFormPayload): Promise<void> {
    await saveContractRequest(payload, undefined);
  }

  function closeBatchModal(): void {
    setBatchOpen(false);
    setBatchDrafts([]);
    startTransitionFn(() => router.refresh());
  }

  async function deleteContract(contractId: string): Promise<void> {
    if (!canEdit || deletingId) {
      return;
    }

    setDeletingId(contractId);

    try {
      await deleteContractRequest(contractId, proyectoId);
      setContractList((previous) => previous.filter((item) => item.id !== contractId));
      if (selectedId === contractId) {
        setSelectedId(null);
      }
      toast.success("Contrato eliminado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al eliminar contrato.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleLoadMore(): void {
    if (!nextCursor) {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.set("cursor", nextCursor);
    router.push(`${pathname}?${next.toString()}`);
  }

  async function handleBatchPdfs(files: FileList): Promise<void> {
    if (!files.length) return;
    setBatchExtracting(true);
    setBatchError(null);

    const results = await Promise.all(
      Array.from(files).map(async (file) => {
        try {
          const formData = new FormData();
          formData.set("file", file);
          const response = await fetch(
            `/api/contracts/extract?proyectoId=${encodeURIComponent(proyectoId)}`,
            { method: "POST", body: formData }
          );
          const data = (await response.json()) as ExtractionApiResponse;
          if (!response.ok) {
            throw new Error(data.message ?? `Error extrayendo ${file.name}`);
          }
          return { file, data, error: null };
        } catch (err) {
          return { file, data: null, error: err instanceof Error ? err.message : "Error" };
        }
      })
    );

    const successes = results.filter((r) => r.data !== null);
    const failures = results.filter((r) => r.error !== null);

    if (failures.length > 0) {
      toast.warning(
        `${failures.length} archivo${failures.length > 1 ? "s" : ""} no se pudo${failures.length > 1 ? "n" : ""} extraer: ${failures.map((r) => r.file.name).join(", ")}`
      );
    }

    if (successes.length === 0) {
      setBatchError("No se pudo extraer ningún archivo. Verifica el formato.");
      setBatchExtracting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      return;
    }

    const drafts: BatchDraft[] = successes.map(({ file, data }) => ({
      id: crypto.randomUUID(),
      source: "pdf",
      label: file.name,
      payload: extractionToDraft(data!, proyectoId)
    }));

    setBatchDrafts(drafts);
    setBatchOpen(true);
    setBatchExtracting(false);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  async function handleBatchExcel(file: File): Promise<void> {
    setBatchExtracting(true);
    setBatchError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("proyectoId", proyectoId);

      const response = await fetch("/api/contracts/batch-parse", {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as {
        contracts: BatchParseApiContract[];
        skipped: number;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Error al procesar el Excel.");
      }

      if (data.contracts.length === 0) {
        setBatchError("No se encontraron contratos en el archivo. Verifica el formato y que las filas de ejemplo estén eliminadas.");
        return;
      }

      const drafts: BatchDraft[] = data.contracts.map(({ localCodigo, arrendatarioNombre, ...payload }) => {
        const localLabel = locals.find((l) => l.id === payload.localId)?.label ?? localCodigo;
        return {
          id: crypto.randomUUID(),
          source: "xlsx",
          label: `${localLabel} — ${arrendatarioNombre}`,
          payload
        };
      });

      if (data.skipped > 0) {
        toast.info(
          `${data.skipped} fila${data.skipped > 1 ? "s" : ""} omitida${data.skipped > 1 ? "s" : ""} por datos incompletos.`
        );
      }

      setBatchDrafts(drafts);
      setBatchOpen(true);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Error al procesar el Excel.");
    } finally {
      setBatchExtracting(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <section className="space-y-3 rounded-md bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Carga en lote</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Multi-PDF zone */}
            <label
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-5 text-center transition-colors ${
                batchExtracting
                  ? "cursor-not-allowed border-slate-200 bg-slate-50"
                  : "border-slate-300 hover:border-brand-400 hover:bg-brand-50/40"
              }`}
            >
              <UploadCloud className="h-6 w-6 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Subir PDFs en lote</p>
                <p className="text-xs text-slate-500">Múltiples contratos PDF o imágenes</p>
              </div>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                multiple
                disabled={batchExtracting}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    void handleBatchPdfs(e.target.files);
                  }
                }}
              />
            </label>

            {/* Excel zone */}
            <label
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-5 text-center transition-colors ${
                batchExtracting
                  ? "cursor-not-allowed border-slate-200 bg-slate-50"
                  : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40"
              }`}
            >
              <FileSpreadsheet className="h-6 w-6 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Subir Excel</p>
                <p className="text-xs text-slate-500">Usa la plantilla de contratos (.xlsx / .csv)</p>
              </div>
              <input
                ref={xlsxInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={batchExtracting}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleBatchExcel(file);
                }}
              />
            </label>
          </div>

          {batchExtracting ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Spinner className="text-slate-500" />
              <span>Procesando archivos...</span>
            </div>
          ) : null}

          {batchError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {batchError}
            </p>
          ) : null}
        </section>
      ) : null}

      <ContractForm
        proyectoId={proyectoId}
        locals={locals}
        arrendatarios={arrendatarios}
        onSave={saveContract}
        onCancel={() => {}}
        canEdit={canEdit}
      />

      <ContractList
        contracts={contractList}
        onEdit={openEditModal}
        onDelete={setPendingDeleteId}
        canEdit={canEdit}
        nextCursor={nextCursor}
        onLoadMore={handleLoadMore}
        deletingId={deletingId}
      />

      <ConfirmModal
        open={Boolean(pendingDeleteId)}
        title="Eliminar contrato"
        description="Se eliminara el contrato seleccionado. Esta accion no se puede deshacer."
        confirmLabel={deletingId ? "Eliminando..." : "Eliminar"}
        onConfirm={() => {
          if (!pendingDeleteId || deletingId) {
            return;
          }
          void deleteContract(pendingDeleteId).finally(() => setPendingDeleteId(null));
        }}
        onCancel={() => {
          if (deletingId) {
            return;
          }
          setPendingDeleteId(null);
        }}
      />

      <ContractEditModal
        open={editModalOpen}
        contract={selectedContract}
        proyectoId={proyectoId}
        locals={locals}
        arrendatarios={arrendatarios}
        canEdit={canEdit}
        onSave={saveEditedContract}
        onClose={closeEditModal}
      />

      <BatchReviewModal
        open={batchOpen}
        drafts={batchDrafts}
        proyectoId={proyectoId}
        locals={locals}
        arrendatarios={arrendatarios}
        canEdit={canEdit}
        onApprove={saveContractBatch}
        onClose={closeBatchModal}
      />
    </div>
  );
}
