export type GgccCostBreakdown = {
  contribuciones: number;
  gastosOperaciones: number;
  manoDeObra: number;
  gastosAdmin: number;
  total: number;
};

export type GgccDeficitPeriodRow = {
  period: string;
  recoveryUf: number;
  costUf: number;
  deficitUf: number;
  deficitPct: number;
  costBreakdown: GgccCostBreakdown;
  recoveryUfM2: number;
  costUfM2: number;
  deficitUfM2: number;
};

export type GgccDeficitByDimension = {
  dimension: string;
  rows: GgccDeficitPeriodRow[];
};

export type GgccDeficitResponse = {
  periods: string[];
  overall: GgccDeficitPeriodRow[];
  bySize: GgccDeficitByDimension[];
  manoDeObraIngresosRatio: Record<string, number>;
};
