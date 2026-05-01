export type DailyDimensionRow = {
  label: string;
  values: Array<{ day: number; uf: number; ufM2: number }>;
  totalUf: number;
  totalUfM2: number;
};

export type VentasDiariasResponse = {
  period: string;
  daysInMonth: number;
  total: DailyDimensionRow;
  byTamano: DailyDimensionRow[];
  byTipo: DailyDimensionRow[];
  byPiso: DailyDimensionRow[];
  byStore: DailyDimensionRow[];
};
