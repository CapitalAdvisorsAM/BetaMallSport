"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ContractEditModal } from "@/components/contracts/ContractEditModal";
import { useContractApi } from "@/hooks/useContractApi";
import type {
  ContractFormPayload,
  ContractManagerListItem,
  ContractManagerOption
} from "@/types";

type ContractDetailEditButtonProps = {
  contract: ContractManagerListItem;
  proyectoId: string;
  locals: ContractManagerOption[];
  arrendatarios: ContractManagerOption[];
};

export function ContractDetailEditButton({
  contract,
  proyectoId,
  locals,
  arrendatarios
}: ContractDetailEditButtonProps): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { saveContract } = useContractApi();

  async function handleSave(payload: ContractFormPayload): Promise<void> {
    try {
      await saveContract(payload, contract.id);
      toast.success("Contrato actualizado correctamente.");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar contrato.");
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Editar contrato
      </Button>
      <ContractEditModal
        open={open}
        contract={contract}
        proyectoId={proyectoId}
        locals={locals}
        arrendatarios={arrendatarios}
        canEdit
        onSave={handleSave}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
