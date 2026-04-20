export type VentasSeriesPoint = {
  period: string;
  salesPesos: number;
  glaM2: number;
  salesPesosM2: number;
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
