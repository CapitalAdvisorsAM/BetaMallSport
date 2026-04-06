import type { GgccListItem } from "@/components/contracts/GgccListEditor";
import type { RentaVariableListItem } from "@/components/contracts/RentaVariableListEditor";
import type { TarifaListItem } from "@/components/contracts/TarifaListEditor";
import type { ContractFormPayload, ContractManagerListItem, ContractManagerOption } from "@/types";

export type ContractDraftPayload = Omit<ContractFormPayload, "tarifas" | "ggcc" | "rentaVariable"> & {
  tarifas: TarifaListItem[];
  rentaVariable: RentaVariableListItem[];
  ggcc: GgccListItem[];
};

export type UploadReviewExtras = {
  numeroContrato: string;
};

export type ContractFormProps = {
  initialData?: ContractManagerListItem | null;
  initialDraft?: ContractDraftPayload;
  proyectoId: string;
  locals: ContractManagerOption[];
  arrendatarios: ContractManagerOption[];
  onSave: (payload: ContractFormPayload) => Promise<void> | void;
  onCancel: () => void;
  canEdit: boolean;
  batchMode?: boolean;
  uploadReviewMode?: boolean;
  uploadReviewExtras?: UploadReviewExtras;
  onUploadReviewExtrasChange?: (extras: UploadReviewExtras) => void;
  onDraftChange?: (draft: ContractDraftPayload) => void;
  hideActions?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
};
