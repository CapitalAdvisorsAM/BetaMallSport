"use client";

import { useMemo } from "react";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { chartColors } from "@/lib/charts/theme";
import { cn, formatDecimal } from "@/lib/utils";

export type RentRollCategoryConcentrationDatum = {
  categoria: string;
  glam2: number;
  pct: number;
  contratos: number;
};

type RentRollCategoryConcentrationProps = {
  data: RentRollCategoryConcentrationDatum[];
};

// Ranked palette — leader gets the deepest brand tone, tail fades to surface.
// Sequence: navy → primary blue → gold → light blue → slate → gold-light → ...
const CATEGORY_PALETTE = [
  chartColors.brandDark, // #011E42
  chartColors.brandPrimary, // #164786
  chartColors.gold, // #d4a84b
  chartColors.brandLight, // #93C5FD
  "#475569", // slate-600
  chartColors.goldLight, // #f0d080
  "#94a3b8", // slate-400
  chartColors.brandSurface, // #DBEAFE
  "#cbd5e1" // slate-300
] as const;

function colorFor(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

// Returns true when a color is dark enough that white text reads cleanly on it.
function isDarkColor(hex: string): boolean {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) return false;
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  // perceptual luminance (Rec. 709)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55;
}

export function RentRollCategoryConcentration({
  data
}: RentRollCategoryConcentrationProps): JSX.Element {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.pct - a.pct),
    [data]
  );

  const totals = useMemo(() => {
    const glam2 = sorted.reduce((acc, d) => acc + d.glam2, 0);
    const contratos = sorted.reduce((acc, d) => acc + d.contratos, 0);
    return { glam2, contratos };
  }, [sorted]);

  // Pareto: how much of the total is captured by the top N categories.
  // Most useful single concentration sentence: "Top 3 = X%".
  const top3 = useMemo(
    () => sorted.slice(0, 3).reduce((acc, d) => acc + d.pct, 0),
    [sorted]
  );

  if (sorted.length === 0) {
    return (
      <MetricChartCard
        title="Concentración de GLA arrendado por categoría"
        metricId="chart_rent_roll_concentracion_gla_categoria"
        description="Distribución del GLA arrendado por zona del local. Snapshot de contratos vigentes."
      >
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/40 text-sm text-slate-500">
          No hay contratos activos con GLA arrendado para la fecha seleccionada.
        </div>
      </MetricChartCard>
    );
  }

  // Width threshold (in % of total) for showing labels INSIDE mosaic segments.
  const MOSAIC_INLINE_LABEL_MIN_PCT = 8;

  return (
    <MetricChartCard
      title="Concentración de GLA arrendado por categoría"
      metricId="chart_rent_roll_concentracion_gla_categoria"
      description="Distribución del GLA arrendado por zona del local. Snapshot de contratos vigentes."
    >
      <div className="space-y-6">
        {/* Mosaic — 100% segmented bar with inline labels for big segments */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Mosaico
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
              {formatDecimal(totals.glam2)} m² · {totals.contratos} contratos · {sorted.length} categorías
            </span>
          </div>
          <div
            className="flex h-12 w-full overflow-hidden rounded-md ring-1 ring-inset ring-slate-200/80"
            role="img"
            aria-label="Mosaico de la distribución del GLA arrendado por categoría"
          >
            {sorted.map((item, i) => {
              const color = colorFor(i);
              const dark = isDarkColor(color);
              const showLabel = item.pct >= MOSAIC_INLINE_LABEL_MIN_PCT;
              return (
                <div
                  key={item.categoria}
                  className="group/seg relative flex items-center justify-start overflow-hidden px-2 transition-[filter] duration-300 hover:brightness-110"
                  style={{
                    width: `${item.pct}%`,
                    backgroundColor: color
                  }}
                  title={`${item.categoria} — ${formatDecimal(item.pct)}% (${formatDecimal(item.glam2)} m², ${item.contratos} contratos)`}
                >
                  {showLabel ? (
                    <div className="flex min-w-0 flex-col leading-tight">
                      <span
                        className={cn(
                          "truncate font-serif text-[12px] tracking-tight",
                          dark ? "text-white" : "text-brand-700"
                        )}
                        style={{ fontVariationSettings: '"opsz" 14, "wght" 600' }}
                      >
                        {item.categoria}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px] tabular-nums",
                          dark ? "text-white/80" : "text-brand-700/70"
                        )}
                      >
                        {formatDecimal(item.pct)}%
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Pareto sentence */}
          <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-gold-400" />
              Top {Math.min(3, sorted.length)}
            </span>
            <span aria-hidden className="h-px flex-1 bg-slate-200" />
            <span className="tabular-nums text-slate-700">
              <span
                className="font-serif text-[13px]"
                style={{ fontVariationSettings: '"opsz" 14, "wght" 500' }}
              >
                {formatDecimal(top3)}%
              </span>{" "}
              del GLA arrendado
            </span>
          </div>
        </div>

        {/* Ranked rows — bars scaled to 100% (absolute), not to leader */}
        <ol className="-mx-2 divide-y divide-slate-100">
          {sorted.map((item, i) => {
            const isLeader = i === 0;
            const color = colorFor(i);
            return (
              <li
                key={item.categoria}
                className="group grid animate-fade-up grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-4 px-2 py-3"
                style={{
                  animationDelay: `${i * 45}ms`,
                  animationFillMode: "both"
                }}
              >
                {/* Rank + leader tick */}
                <div className="flex flex-col items-start justify-center">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {isLeader ? (
                    <span
                      aria-hidden
                      className="mt-1 h-px w-5 bg-gold-400"
                      style={{ boxShadow: "0 1px 0 rgb(212 168 75 / 0.4)" }}
                    />
                  ) : null}
                </div>

                {/* Name + proportional bar (scaled to 100%) */}
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 truncate">
                      <span
                        aria-hidden
                        className="inline-block size-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className={cn(
                          "truncate font-serif tracking-tight transition-colors",
                          isLeader ? "text-brand-700" : "text-slate-900",
                          "group-hover:text-brand-500"
                        )}
                        style={{
                          fontVariationSettings: isLeader
                            ? '"opsz" 24, "wght" 600'
                            : '"opsz" 14, "wght" 500',
                          fontSize: isLeader ? "16px" : "14px"
                        }}
                      >
                        {item.categoria}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500 tabular-nums">
                      {formatDecimal(item.glam2)} m² · {item.contratos} contratos
                    </span>
                  </div>

                  {/* Proportional bar — width = pct of 100, with quarter ticks */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    {/* Quarter reference ticks */}
                    {[0.25, 0.5, 0.75].map((tick) => (
                      <span
                        key={tick}
                        aria-hidden
                        className="absolute top-0 h-full w-px bg-slate-200"
                        style={{ left: `${tick * 100}%` }}
                      />
                    ))}
                    <div
                      className="relative h-full origin-left rounded-full"
                      style={{
                        width: `${Math.max(item.pct, 0.6)}%`,
                        backgroundColor: color,
                        transition:
                          "width 720ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms"
                      }}
                    />
                  </div>
                </div>

                {/* Big percentage on the right */}
                <div className="flex items-baseline justify-end gap-0.5 pl-2">
                  <span
                    className={cn(
                      "font-serif tabular-nums leading-none",
                      isLeader ? "text-brand-700" : "text-slate-800"
                    )}
                    style={{
                      fontVariationSettings: isLeader
                        ? '"opsz" 36, "wght" 500'
                        : '"opsz" 24, "wght" 400',
                      fontSize: isLeader ? "26px" : "20px"
                    }}
                  >
                    {formatDecimal(item.pct)}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    %
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Scale legend — single hairline row showing 0/25/50/75/100% */}
        <div className="-mt-2 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-x-4 px-2">
          <span />
          <div className="relative h-3">
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <span
                key={tick}
                className="absolute top-0 -translate-x-1/2 font-mono text-[9px] uppercase tracking-wider text-slate-400 tabular-nums"
                style={{ left: `${tick * 100}%` }}
              >
                {tick === 1 ? "100%" : `${tick * 100}%`}
              </span>
            ))}
          </div>
          <span />
        </div>
      </div>
    </MetricChartCard>
  );
}
