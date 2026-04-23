import type { ContractDayStatus } from "@prisma/client";

export type {
  BudgetedSalesMatrixResponse,
  BudgetedSalesMatrixRow,
  BudgetedSalesMatrixSummary,
} from "@/lib/plan/budgeted-sales-matrix";

export type EstadoLocal = ContractDayStatus;

export type RentRollRow = {
  localId: string;
  contratoVigenteId: string | null;
  localCodigo: string;
  localNombre: string;
  glam2: number;
  estado: EstadoLocal;
  arrendatario: string | null;
  tarifaUfM2: number | null;
  rentaFijaUf: number | null;
  ggccUf: number | null;
  ventasPesos: number | null;
  fechaTermino: string | null;
  diasParaVencimiento: number | null;
};

export type RentRollKpis = {
  glaTotal: number;
  glaCupado: number;
  pctOcupacion: number;
  rentaFijaTotalUf: number;
  ggccTotalUf: number;
};

export type BudgetedSaleCellPayload = {
  projectId: string;
  tenantId: string;
  period: string;
  salesPesos: string | null;
};

export type BudgetedSaleCellResponse = {
  tenantId: string;
  period: string;
  salesPesos: string | null;
};
