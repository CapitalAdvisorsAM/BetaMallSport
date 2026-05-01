export type PanelCdgUnit = "uf" | "m2" | "pct" | "uf_m2";

export type PanelCdgCell = {
  real: number | null;
  ppto: number | null;
  prior: number | null;
  yoy: number | null;
};

export type PanelCdgKpi = {
  key: string;
  label: string;
  unit: PanelCdgUnit;
  section?: string | null;
  mes: PanelCdgCell;
  ytd: PanelCdgCell;
};

export type PanelCdgResponse = {
  reportDate: string | null;
  kpis: PanelCdgKpi[];
};
