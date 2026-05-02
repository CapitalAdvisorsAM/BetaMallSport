export type FacturacionSeriesPoint = {
  period: string;
  totalUf: number;
  glaM2: number;
  ufPerM2: number;
  breakdown?: Record<string, number>;
};

export type FacturacionDimensionSeries = {
  dimension: string;
  data: FacturacionSeriesPoint[];
};

export type BillingTypeTotalsPoint = {
  period: string;
  fijoUf: number;
  fijoUfPerM2: number;
  variableUf: number;
  variableUfPerM2: number;
  pctFijo: number;
};

export type FacturacionResponse = {
  periods: string[];
  series: FacturacionDimensionSeries[];
  totals: FacturacionSeriesPoint[];
  availableGroup3: string[];
  billingTypeTotals: BillingTypeTotalsPoint[];
};
