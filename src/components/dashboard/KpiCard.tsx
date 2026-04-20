import type { ReactNode } from "react";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { DeltaPill } from "@/components/ui/DeltaPill";
import { chartColors } from "@/lib/charts/theme";
import type { MetricFormulaId } from "@/lib/metric-formulas";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  metricId?: MetricFormulaId;
  title: string;
  value: ReactNode;
  subtitle?: string;
  subtitleClassName?: string;
  accent?: "green" | "yellow" | "red" | "slate";
  detail?: ReactNode;
  titleAttribute?: string;
  sparkline?: number[];
  trend?: { value: number; label?: string };
  actions?: ReactNode;
};

const accentStyles: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  green: "border-t-2 border-t-emerald-500",
  yellow: "border-t-2 border-t-gold-400",
  red: "border-t-2 border-t-rose-500",
  slate: "border-t-2 border-t-brand-500"
};

const SPARKLINE_W = 80;
const SPARKLINE_H = 28;

function buildSparklinePath(values: number[]): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = SPARKLINE_W / (values.length - 1);

  return values
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (SPARKLINE_H - ((v - min) / range) * SPARKLINE_H).toFixed(1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function Sparkline({ values, tone, gradientId }: {
  values: number[];
  tone: "up" | "down" | "flat";
  gradientId: string;
}): JSX.Element | null {
  if (values.length < 2) return null;
  const path = buildSparklinePath(values);
  const color = tone === "up"
    ? chartColors.positiveLight
    : tone === "down"
      ? chartColors.negativeLight
      : chartColors.axisMuted;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const lastVal = values[values.length - 1];
  const cy = SPARKLINE_H - ((lastVal - min) / range) * SPARKLINE_H;

  return (
    <svg
      width={SPARKLINE_W}
      height={SPARKLINE_H}
      viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
      className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${SPARKLINE_W} ${SPARKLINE_H} L 0 ${SPARKLINE_H} Z`}
        fill={`url(#${gradientId})`}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={SPARKLINE_W} cy={cy} r="2.5" fill={color} />
    </svg>
  );
}

export function KpiCard({
  metricId,
  title,
  value,
  subtitle,
  subtitleClassName,
  detail,
  titleAttribute,
  accent = "slate",
  sparkline,
  trend,
  actions
}: KpiCardProps): JSX.Element {
  const sparkTone: "up" | "down" | "flat" = trend
    ? trend.value > 0.1 ? "up" : trend.value < -0.1 ? "down" : "flat"
    : "flat";
  const gradientId = `spark-${metricId ?? title.replace(/\s+/g, "-")}`;

  return (
    <article
      title={titleAttribute}
      className={cn(
        "group rounded-md border border-surface-200 bg-white p-4",
        "shadow-card transition-shadow duration-200 hover:shadow-card-hover",
        accentStyles[accent]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="overline text-slate-400">{title}</p>
        <div className="flex items-center gap-1">
          {actions ?? null}
          {metricId ? <MetricTooltip metricId={metricId} /> : null}
        </div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p
          className="font-serif text-display text-brand-700 num"
          style={{ fontVariationSettings: '"opsz" 48, "wght" 500' }}
        >
          {value}
        </p>
        {sparkline && sparkline.length >= 2 ? (
          <Sparkline values={sparkline} tone={sparkTone} gradientId={gradientId} />
        ) : null}
      </div>
      {subtitle ? (
        <p className={cn("mt-1 text-xs text-slate-500", subtitleClassName)}>{subtitle}</p>
      ) : null}
      {trend ? (
        <div className="mt-2 flex items-center gap-2">
          <DeltaPill value={trend.value} kind="ingreso" mode="variance" suffix="%" />
          {trend.label ? (
            <span className="text-[11px] text-slate-400 num">{trend.label}</span>
          ) : null}
        </div>
      ) : null}
      {detail ? <div className="mt-2">{detail}</div> : null}
    </article>
  );
}
