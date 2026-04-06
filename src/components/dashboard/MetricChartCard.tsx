import type { ReactNode } from "react";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { MetricFormulaId } from "@/lib/metric-formulas";
import { cn } from "@/lib/utils";

type MetricChartCardProps = {
  title: string;
  metricId: MetricFormulaId;
  description?: string;
  className?: string;
  children: ReactNode;
};

export function MetricChartCard({
  title,
  metricId,
  description,
  className,
  children
}: MetricChartCardProps): JSX.Element {
  return (
    <article className={cn("overflow-hidden rounded-md bg-white shadow-sm", className)}>
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-brand-700">{title}</h3>
          <MetricTooltip metricId={metricId} />
        </div>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </article>
  );
}
