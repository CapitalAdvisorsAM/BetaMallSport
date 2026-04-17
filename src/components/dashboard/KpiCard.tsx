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
  green: "border-t-2 border-t-emerald-500",
  yellow: "border-t-2 border-t-gold-400",
  red: "border-t-2 border-t-rose-500",
  slate: "border-t-2 border-t-brand-500"
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
      className={cn(
        "rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5",
        "shadow transition-shadow duration-200 hover:shadow-md",
        accentStyles[accent]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
        <MetricTooltip metricId={metricId} />
      </div>
      <div className="mt-3 inline-flex max-w-full flex-wrap items-center gap-2">
        <p className="font-mono tabular-nums text-3xl font-bold tracking-tight text-brand-700">{value}</p>
      </div>
      {subtitle ? (
        <p className={cn("mt-1.5 text-xs font-medium text-slate-500", subtitleClassName)}>{subtitle}</p>
      ) : null}
      {detail ? <div className="mt-2">{detail}</div> : null}
    </article>
  );
}
