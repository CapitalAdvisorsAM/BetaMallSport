"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  evaluateFormula,
  type FormulaConfig,
  type DisplayFormat,
} from "@/lib/dashboard/custom-widget-engine";
import type { PeriodoMetrica } from "@/types/timeline";

type CustomWidgetRow = {
  id: string;
  title: string;
  chartType: string;
  enabled: boolean;
  position: number;
  formulaConfig: FormulaConfig;
};

type Props = {
  widget: CustomWidgetRow;
  periodos: PeriodoMetrica[];
};

// ── Formatting ──────────────────────────────────────────────────────────────

function getFormat(config: FormulaConfig): DisplayFormat {
  return config.format;
}

const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function formatPeriodo(periodo: string): string {
  const [yearStr, monthStr] = periodo.split("-");
  const monthIdx = Number(monthStr) - 1;
  const year = String(Number(yearStr)).slice(-2);
  return `${MESES_ES[monthIdx] ?? monthStr} ${year}`;
}

function formatValue(value: number, format: DisplayFormat): string {
  switch (format) {
    case "percent":
      return `${value.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    case "uf":
      return value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "m2":
      return `${value.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} m²`;
    case "months":
      return value >= 12
        ? `${(value / 12).toFixed(1)} años`
        : `${value.toFixed(1)} meses`;
    default:
      return value.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  }
}

function getUnit(format: DisplayFormat): string | null {
  return format === "uf" ? "UF" : null;
}

// ── Sparkline ────────────────────────────────────────────────────────────────

const SPARKLINE_W = 80;
const SPARKLINE_H = 28;
const SPARK_POINTS = 8;

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

// ── Trend ────────────────────────────────────────────────────────────────────

type Trend = "up" | "down" | "flat" | "none";

function computeTrend(latest: number, prev: number | null): { trend: Trend; deltaPct: number | null } {
  if (prev === null || prev === 0) return { trend: "none", deltaPct: null };
  const delta = ((latest - prev) / Math.abs(prev)) * 100;
  if (Math.abs(delta) < 0.1) return { trend: "flat", deltaPct: 0 };
  return { trend: delta > 0 ? "up" : "down", deltaPct: delta };
}

const trendConfig: Record<Trend, { accent: string; badge: string; arrow: string }> = {
  up:   { accent: "border-l-emerald-500", badge: "bg-emerald-50 text-emerald-700", arrow: "↑" },
  down: { accent: "border-l-rose-500",    badge: "bg-rose-50 text-rose-700",       arrow: "↓" },
  flat: { accent: "border-l-brand-500",   badge: "bg-slate-100 text-slate-500",    arrow: "→" },
  none: { accent: "border-l-brand-500",   badge: "",                               arrow: ""  },
};

// ── Component ────────────────────────────────────────────────────────────────

export function CustomKpiCard({ widget, periodos }: Props) {
  const { displayValue, unit, periodo, trend, deltaPct, sparkValues } = useMemo(() => {
    const points = evaluateFormula(periodos, widget.formulaConfig);
    const historical = points.filter((p) => !p.esFuturo && p.value !== null);

    if (historical.length === 0) {
      return { displayValue: "—", unit: null, periodo: null, trend: "none" as Trend, deltaPct: null, sparkValues: [] };
    }

    const latest = historical[historical.length - 1];
    const prev   = historical.length >= 2 ? historical[historical.length - 2] : null;

    const format = getFormat(widget.formulaConfig);
    const { trend, deltaPct } = computeTrend(latest.value!, prev?.value ?? null);

    // Last N historical points for sparkline
    const sparkSlice = historical.slice(-SPARK_POINTS).map((p) => p.value!);

    return {
      displayValue: formatValue(latest.value!, format),
      unit: getUnit(format),
      periodo: latest.periodo,
      trend,
      deltaPct,
      sparkValues: sparkSlice,
    };
  }, [periodos, widget.formulaConfig]);

  const cfg = trendConfig[trend];
  const sparkPath = buildSparklinePath(sparkValues);
  const sparkColor = trend === "up" ? "#10b981" : trend === "down" ? "#f43f5e" : "#94a3b8";
  const noData = displayValue === "—";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-md border border-slate-100 bg-white shadow-sm",
        "border-l-4 transition-shadow hover:shadow-md",
        cfg.accent
      )}
    >
      <div className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-tight">
            {widget.title}
          </p>

          {/* Trend badge */}
          {!noData && trend !== "none" && deltaPct !== null && (
            <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", cfg.badge)}>
              {cfg.arrow} {Math.abs(deltaPct).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Value */}
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={cn(
              "tabular-nums text-[1.75rem] font-bold leading-none tracking-tight",
              noData ? "text-slate-300" : "text-brand-700"
            )}>
              {displayValue}
              {unit && !noData && (
                <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
              )}
            </p>

            {/* Period label */}
            {periodo && !noData && (
              <p className="mt-1.5 text-xs text-slate-400">
                {formatPeriodo(periodo)}
              </p>
            )}
            {noData && (
              <p className="mt-1.5 text-xs text-slate-400">Sin datos</p>
            )}
          </div>

          {/* Sparkline */}
          {sparkValues.length >= 2 && (
            <svg
              width={SPARKLINE_W}
              height={SPARKLINE_H}
              viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
              className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
              aria-hidden
            >
              {/* Filled area under the line */}
              <defs>
                <linearGradient id={`spark-fill-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${sparkPath} L ${SPARKLINE_W} ${SPARKLINE_H} L 0 ${SPARKLINE_H} Z`}
                fill={`url(#spark-fill-${widget.id})`}
              />
              <path
                d={sparkPath}
                fill="none"
                stroke={sparkColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dot on latest value */}
              {(() => {
                const vals = sparkValues;
                const min = Math.min(...vals);
                const max = Math.max(...vals);
                const range = max - min || 1;
                const lastVal = vals[vals.length - 1];
                const cx = SPARKLINE_W;
                const cy = SPARKLINE_H - ((lastVal - min) / range) * SPARKLINE_H;
                return (
                  <circle cx={cx} cy={cy} r="2.5" fill={sparkColor} />
                );
              })()}
            </svg>
          )}
        </div>
      </div>
    </article>
  );
}
