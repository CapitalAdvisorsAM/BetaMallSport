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

export type OccupancyTimeSeriesResponse = {
  periods: string[];
  snapshots: OccupancyPeriodSnapshot[];
};
