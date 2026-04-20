import type { ReactNode } from "react";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { MetricFormulaId } from "@/lib/metric-formulas";
import { cn } from "@/lib/utils";

type MetricChartCardProps = {
  title: string;
  metricId: MetricFormulaId;
  description?: string;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function MetricChartCard({
  title,
  metricId,
  description,
  className,
  actions,
  children
}: MetricChartCardProps): JSX.Element {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-md border border-surface-200 bg-white shadow-card transition-shadow hover:shadow-card-hover",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-200 bg-surface-50/60 px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-title text-brand-700" style={{ fontVariationSettings: '"opsz" 32, "wght" 500' }}>
              {title}
            </h3>
            <MetricTooltip metricId={metricId} />
          </div>
          {description ? <p className="mt-1 text-caption text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </article>
  );
}
