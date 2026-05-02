export type CostoOcupacionRow = {
  tenantId: string;
  tenantName: string;
  categoriaTamano: string;
  locales: { codigo: string; nombre: string }[];
  glaM2: number;
  facturacionUf: number;
  ventasUf: number;
  facturacionUfM2: number;
  ventasUfM2: number;
  costoOcupacionPct: number | null;
  facturacionYtdUf: number;
  ventasYtdUf: number;
  facturacionYtdUfM2: number;
  ventasYtdUfM2: number;
  costoOcupacionYtdPct: number | null;
};

export type CostoOcupacionResponse = {
  period: string;
  ytdFrom: string;
  rows: CostoOcupacionRow[];
};

export type CostoOcupacionTimeseriesSeries = {
  dimension: string;
  data: (number | null)[];
};

export type CostoOcupacionTimeseriesResponse = {
  periods: string[];
  series: CostoOcupacionTimeseriesSeries[];
};
