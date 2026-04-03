"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ContractForm } from "@/components/contracts/ContractForm";
import { ContractList } from "@/components/contracts/ContractList";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useContractApi } from "@/hooks/useContractApi";
import type { ContractFormPayload, ContractManagerListItem, ContractManagerOption } from "@/types";

type ContractManagerProps = {
  proyectoId: string;
  canEdit: boolean;
  locals: ContractManagerOption[];
  arrendatarios: ContractManagerOption[];
  contracts: ContractManagerListItem[];
  nextCursor?: string;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
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
    await saveContractRequest(payload, selectedId ?? undefined);
    toast.success(selectedId ? "Contrato actualizado correctamente." : "Contrato guardado correctamente.");
    startTransitionFn(() => {
      router.refresh();
    });
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

  return (
    <div className="space-y-4">
      <ContractForm
        initialData={selectedContract}
        proyectoId={proyectoId}
        locals={locals}
        arrendatarios={arrendatarios}
        onSave={saveContract}
        onCancel={() => {
          setSelectedId(null);
        }}
        canEdit={canEdit}
      />

      <ContractList
        contracts={contractList}
        onEdit={setSelectedId}
        onDelete={setPendingDeleteId}
        canEdit={canEdit}
        nextCursor={nextCursor}
        onLoadMore={handleLoadMore}
        selectedId={selectedId}
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
    </div>
  );
}
