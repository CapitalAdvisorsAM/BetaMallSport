import type { ReactNode } from "react";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { MetricFormulaId } from "@/lib/metric-formulas";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  metricId: MetricFormulaId;
  title: string;
  value: ReactNode;
  subtitle?: string;
  subtitleClassName?: string;
  accent?: "green" | "yellow" | "red" | "slate";
  detail?: ReactNode;
  titleAttribute?: string;
};

const accentStyles: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  green: "border-l-4 border-l-emerald-500 bg-white",
  yellow: "border-l-4 border-l-gold-400 bg-white",
  red: "border-l-4 border-l-rose-500 bg-white",
  slate: "border-l-4 border-l-brand-500 bg-white"
};

export function KpiCard({
  metricId,
  title,
  value,
  subtitle,
  subtitleClassName,
  detail,
  titleAttribute,
  accent = "slate"
}: KpiCardProps): JSX.Element {
  return (
    <article
      title={titleAttribute}
      className={cn("rounded-lg border border-slate-200 p-5 shadow-sm", accentStyles[accent])}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
        <MetricTooltip metricId={metricId} />
      </div>
      <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-2">
        <p className="tabular-nums text-3xl font-bold tracking-tight text-brand-700">{value}</p>
      </div>
      {subtitle ? (
        <p className={cn("mt-1.5 text-xs font-medium text-slate-500", subtitleClassName)}>{subtitle}</p>
      ) : null}
      {detail ? <div className="mt-2">{detail}</div> : null}
    </article>
  );
}
