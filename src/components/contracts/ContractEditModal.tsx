"use client";

import { ContractForm } from "@/components/contracts/ContractForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { ContractFormPayload, ContractManagerListItem, ContractManagerOption } from "@/types";

type ContractEditModalProps = {
  open: boolean;
  contract: ContractManagerListItem | null;
  proyectoId: string;
  locals: ContractManagerOption[];
  arrendatarios: ContractManagerOption[];
  canEdit: boolean;
  onSave: (payload: ContractFormPayload) => Promise<void>;
  onClose: () => void;
};

export function ContractEditModal({
  open,
  contract,
  proyectoId,
  locals,
  arrendatarios,
  canEdit,
  onSave,
  onClose
}: ContractEditModalProps): JSX.Element {
  const localLabel = contract
    ? (contract.locales.length > 0 ? contract.locales : [contract.local])
        .map((l) => l.codigo)
        .join(", ")
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[95vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
          <DialogTitle className="text-base font-semibold text-slate-900">
            Editar contrato
            {contract ? ` — ${contract.numeroContrato}` : ""}
          </DialogTitle>
          {contract && localLabel ? (
            <p className="mt-0.5 text-sm text-slate-500">
              {localLabel} &mdash; {contract.arrendatario.nombreComercial}
            </p>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {contract ? (
            <ContractForm
              key={contract.id}
              initialData={contract}
              proyectoId={proyectoId}
              locals={locals}
              arrendatarios={arrendatarios}
              onSave={onSave}
              onCancel={onClose}
              canEdit={canEdit}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
