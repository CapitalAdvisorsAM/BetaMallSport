import { formatUf, formatUfPerM2 } from "@/lib/utils";
import type { SalesMetric } from "@/types/sales-analytics";

export function signValueCls(v: number): string {
  if (v === 0) return "text-slate-300";
  return v < 0 ? "text-red-600" : "text-slate-800";
}

export function nullValueCls(v: number | null): string {
  if (v === null || v === 0) return "text-slate-300";
  return "text-slate-800";
}

export function formatSalesMetric(value: number | null, metric: SalesMetric): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (metric === "uf_m2") return formatUfPerM2(value);
  if (metric === "uf_total") return formatUf(value, 0);
  if (metric === "share_pct") return `${value.toFixed(1)}%`;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
