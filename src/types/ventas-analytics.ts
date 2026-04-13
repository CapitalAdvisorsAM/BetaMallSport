export type VentasSeriesPoint = {
  period: string;
  salesUf: number;
  glaM2: number;
  salesUfPerM2: number;
};

export type VentasDimensionSeries = {
  dimension: string;
  data: VentasSeriesPoint[];
};

export type VentasAnalyticsResponse = {
  periods: string[];
  series: VentasDimensionSeries[];
  totals: VentasSeriesPoint[];
};
