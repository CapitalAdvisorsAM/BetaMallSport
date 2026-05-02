export type ExpensePivotRow = {
  group1: string;
  group3: string;
  displayOrder: number | null;
  byPeriod: Record<string, number>;
  total: number;
  totalPriorYear: number | null;
};

export type ExpensePivotResponse = {
  periods: string[];
  rows: ExpensePivotRow[];
  totalsByPeriod: Record<string, number>;
  total: number;
  totalPriorYear: number;
};

export type ExpenseDetailRow = {
  id: string;
  period: string;
  denomination: string;
  costCenterCode: string | null;
  unit: { code: string; name: string } | null;
  tenant: { tradeName: string } | null;
  valueUf: number;
};

export type ExpenseDetailResponse = {
  rows: ExpenseDetailRow[];
  total: number;
};
