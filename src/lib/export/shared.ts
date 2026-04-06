export const EXPORT_DATASETS = [
  "proyectos",
  "locales",
  "arrendatarios",
  "contratos",
  "finance_tenants",
  "finance_eerr",
  "finance_mappings",
  "finanzas_arrendatarios",
  "finanzas_eerr",
  "finanzas_mapeos"
] as const;

export type ExportDataset = (typeof EXPORT_DATASETS)[number];
export type ExportScope = "filtered" | "all";

export type ExportExcelQuery = {
  dataset: ExportDataset;
  scope: ExportScope;
  projectId?: string;
  proyectoId?: string;
  q?: string;
  estado?: string;
  vigente?: string;
  desde?: string;
  hasta?: string;
  tab?: string;
};

export function isExportDataset(value: string | null): value is ExportDataset {
  return value !== null && EXPORT_DATASETS.includes(value as ExportDataset);
}

export function isExportScope(value: string | null): value is ExportScope {
  return value === "filtered" || value === "all";
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | undefined): void {
  if (!value) {
    return;
  }
  const normalized = value.trim();
  if (!normalized) {
    return;
  }
  params.set(key, normalized);
}

export function buildExportExcelUrl(query: ExportExcelQuery): string {
  const params = new URLSearchParams();
  params.set("dataset", query.dataset);
  params.set("scope", query.scope);
  setOptionalParam(params, "projectId", query.projectId);
  setOptionalParam(params, "proyectoId", query.proyectoId);
  setOptionalParam(params, "q", query.q);
  setOptionalParam(params, "estado", query.estado);
  setOptionalParam(params, "vigente", query.vigente);
  setOptionalParam(params, "desde", query.desde);
  setOptionalParam(params, "hasta", query.hasta);
  setOptionalParam(params, "tab", query.tab);
  return `/api/export/excel?${params.toString()}`;
}
