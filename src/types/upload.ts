export type RowStatus = "NEW" | "UPDATED" | "UNCHANGED" | "ERROR";

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
};

export type ApplyReport = {
  created: number;
  updated: number;
  skipped: number;
  rejected: number;
  rejectedRows: UploadIssue[];
};
