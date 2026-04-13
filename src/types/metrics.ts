import type { ContractDayStatus } from "@prisma/client";

/** Una fila de metricas por contrato/local vigente */
export type RentRollMetricRow = {
  contratoId: string;
  localCodigo: string;
  localNombre: string;
  arrendatario: string;
  estado: ContractDayStatus;
  glam2: number;
  tarifaUfM2: number;
  rentaFijaUf: number;
  ggccUf: number;
  ventasUf: number | null;
  rentaVariableUf: number | null;
  ingresoBrutoUf: number;
  fechaTermino: string;
  diasVigentes: number;
};

/** Totales del proyecto para el periodo */
export type RentRollSummary = {
  glaTotal: number;
  glaArrendada: number;
  glaVacante: number;
  tasaOcupacion: number;
  rentaFijaTotalUf: number;
  ggccTotalUf: number;
  ventasTotalUf: number | null;
  rentaVariableTotalUf: number | null;
  ingresoBrutoTotalUf: number;
  contratosVigentes: number;
  contratosPorVencer30: number;
  contratosPorVencer60: number;
  contratosPorVencer90: number;
};

/** Respuesta completa del endpoint */
export type RentRollMetricsResponse = {
  proyectoId: string;
  periodo: string;
  filas: RentRollMetricRow[];
  resumen: RentRollSummary;
  generadoEn: string;
};
