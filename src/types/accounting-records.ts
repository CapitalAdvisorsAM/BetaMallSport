export type AccountingRecordRow = {
  id: string;
  period: string; // "YYYY-MM"
  externalUnit: string | null;
  unitId: string | null;
  unitNombre: string | null;
  externalTenant: string | null;
  tenantId: string | null;
  tenantNombre: string | null;
  group1: string;
  group3: string;
  denomination: string;
  valueUf: string; // Decimal → string
  scenario: "REAL" | "PPTO";
  isManuallyEdited: boolean;
  originalValueUf: string | null;
};

export type AccountingGroupOptions = {
  group1: string[];
  group3ByGroup1: Record<string, string[]>;
};

export type AccountingRecordPatchPayload = {
  valueUf?: string;
  group1?: string;
  group3?: string;
  unitId?: string | null;
  tenantId?: string | null;
};

export type AccountingRecordsResponse = {
  data: AccountingRecordRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type AccountingManualEditsWarning = {
  warning: true;
  editedCount: number;
  periods: string[];
};
