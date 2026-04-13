import type { ContractStatus } from "@prisma/client";
import type {
  AlertCounts,
  IngresoDesglosado,
  OcupacionDetalle,
  VencimientosPorAnio
} from "@/lib/kpi";

export type DashboardMetricsResponse = {
  ocupacion: OcupacionDetalle;
  ingresos: IngresoDesglosado;
  alertas: AlertCounts;
  vencimientosPorAnio: VencimientosPorAnio;
  valorUf: { valor: number; fecha: string } | null;
  cartera: { estado: ContractStatus; count: number; pct: number }[];
  rentaEnRiesgo: { ufEnRiesgo: number; count: number };
};
