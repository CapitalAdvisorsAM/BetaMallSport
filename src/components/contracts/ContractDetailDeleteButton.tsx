"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useContractApi } from "@/hooks/useContractApi";

type ContractDetailDeleteButtonProps = {
  contractId: string;
  proyectoId: string;
};

export function ContractDetailDeleteButton({
  contractId,
  proyectoId
}: ContractDetailDeleteButtonProps): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteContract } = useContractApi();

  async function handleDelete(): Promise<void> {
    setIsDeleting(true);
    try {
      await deleteContract(contractId, proyectoId);
      toast.success("Contrato eliminado correctamente.");
      router.push("/plan/contracts");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el contrato.");
      setIsDeleting(false);
      setOpen(false);
    }
  }

  function handleCancel(): void {
    if (isDeleting) return;
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Eliminar contrato
      </Button>
      <ConfirmModal
        open={open}
        title="Eliminar contrato"
        description="Se eliminará el contrato de forma permanente. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={handleCancel}
      />
    </>
  );
}
