import type { ContractDayStatus } from "@prisma/client";

export type {
  BudgetedSalesMatrixResponse,
  BudgetedSalesMatrixRow,
  BudgetedSalesMatrixSummary,
} from "@/lib/rent-roll/budgeted-sales-matrix";

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
  ventasUf: number | null;
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
