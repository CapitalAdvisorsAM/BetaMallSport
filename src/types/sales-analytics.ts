export type SalesMetric = "uf_m2" | "uf_total" | "share_pct" | "yoy_pct";

export type SalesDimension = "tamano" | "tipo" | "piso" | "zona" | "rubro";

export type VentasSeriesPoint = {
  period: string;
  salesPesos: number;
  salesUf: number;
  glaM2: number;
  salesPesosM2: number;
  salesUfM2: number;
  priorSalesUf: number | null;
};

export type VentasDimensionSeries = {
  dimension: string;
  data: VentasSeriesPoint[];
};

export type VentasTimeseriesResponse = {
  mode: "timeseries";
  periods: string[];
  series: VentasDimensionSeries[];
  totals: VentasSeriesPoint[];
};

export type VentasCrosstabCell = {
  salesUf: number;
  glaM2: number;
  ufPerM2: number;
  sharePct: number | null;
  yoyPct: number | null;
};

export type VentasCrosstabResponse = {
  mode: "crosstab";
  rowDim: SalesDimension;
  colDim: SalesDimension;
  rows: string[];
  cols: string[];
  cells: VentasCrosstabCell[][];
  rowTotals: VentasCrosstabCell[];
  colTotals: VentasCrosstabCell[];
  grandTotal: VentasCrosstabCell;
};

export type VentasKpisResponse = {
  mode: "kpis";
  ventasUfTotal: number;
  ufPerM2Period: number;
  yoyPct: number | null;
  localesConVentas: number;
  ufPerM2MensualPromedio: number;
};

export type VentasAnalyticsResponse =
  | VentasTimeseriesResponse
  | VentasCrosstabResponse
  | VentasKpisResponse;

export type TopTenantRow = {
  tenantId: string;
  nombreComercial: string;
  ventasUf: number;
  glaM2: number;
  ufPerM2: number;
  yoyPct: number | null;
  costoOcupacionPct: number | null;
};

export type TopTenantsResponse = {
  rows: TopTenantRow[];
};
