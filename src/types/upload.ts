export type RowStatus = "NEW" | "UPDATED" | "UNCHANGED" | "ERROR";

export type ContractReconciliationKind =
  | "matched_by_natural_key"
  | "creatable_contract"
  | "vacancy_confirmed"
  | "vacancy_conflict"
  | "blocked_row"
  | "ref_ca_mismatch"
  | "skipped_row";

export type ContractReconciliationItem = {
  rowNumber: number;
  kind: ContractReconciliationKind;
  localCodigo: string | null;
  arrendatarioNombre: string | null;
  refCa: string | null;
  message: string;
};

export type ContractReconciliation = {
  summary: {
    matchedByNaturalKey: number;
    creatableContracts: number;
    vacancyConfirmed: number;
    vacancyConflicts: number;
    blockedRows: number;
    refCaMismatches: number;
    skippedRows: number;
  };
  items: ContractReconciliationItem[];
};

export type UploadIssue = {
  rowNumber: number;
  message: string;
};

export type PreviewRow<T> = {
  rowNumber: number;
  status: RowStatus;
  data: T;
  changedFields?: (keyof T)[];
  errorMessage?: string;
};

export type UploadPreview<T> = {
  rows: PreviewRow<T>[];
  summary: {
    total: number;
    nuevo: number;
    actualizado: number;
    sinCambio: number;
    errores: number;
  };
  warnings: string[];
  sourceFormat?: "template" | "rent_roll";
  reconciliation?: ContractReconciliation;
};

export type ApplyReport = {
  created: number;
  updated: number;
  skipped: number;
  rejected: number;
  rejectedRows: UploadIssue[];
};
