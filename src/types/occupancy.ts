export type OccupancyDimensionRow = {
  dimension: string;
  glaTotal: number;
  glaOcupada: number;
  glaVacante: number;
  pctVacancia: number;
};

export type OccupancyPeriodSnapshot = {
  period: string;
  byType: OccupancyDimensionRow[];
  bySize: OccupancyDimensionRow[];
  byFloor: OccupancyDimensionRow[];
  totals: OccupancyDimensionRow;
};

export type VacantUnitRow = {
  id: string;
  codigo: string;
  nombre: string | null;
  piso: string;
  tipo: string;
  categoriaTamano: string | null;
  zona: string | null;
  glam2: number;
};

export type OccupancyTimeSeriesResponse = {
  periods: string[];
  snapshots: OccupancyPeriodSnapshot[];
  vacantUnits: VacantUnitRow[];
};
