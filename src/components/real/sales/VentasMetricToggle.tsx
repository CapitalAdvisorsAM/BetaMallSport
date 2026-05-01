"use client";

import { cn } from "@/lib/utils";
import type { SalesMetric } from "@/types/sales-analytics";

const METRIC_LABELS: Record<SalesMetric, string> = {
  uf_m2: "UF/m²",
  uf_total: "UF totales",
  share_pct: "% Share",
  yoy_pct: "YoY %"
};

const ALL_METRICS: SalesMetric[] = ["uf_m2", "uf_total", "share_pct", "yoy_pct"];

type Props = {
  value: SalesMetric;
  onChange: (next: SalesMetric) => void;
  className?: string;
};

export function VentasMetricToggle({ value, onChange, className }: Props): JSX.Element {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-xs font-medium text-slate-500">Métrica</span>
      {ALL_METRICS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === m
              ? "bg-brand-700 text-white"
              : "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
          )}
        >
          {METRIC_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

export { METRIC_LABELS };
