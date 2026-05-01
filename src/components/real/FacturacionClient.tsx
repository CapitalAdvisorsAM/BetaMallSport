"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import {
  chartAxisProps,
  chartBarRadius,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  buildPeriodoTickFormatter,
  getSeriesColor,
} from "@/lib/charts/theme";
import { cn, formatPeriodoCorto, formatUf, formatUfPerM2, groupPeriodosByYear } from "@/lib/utils";
import type { FacturacionResponse } from "@/types/billing";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DimensionTab = "tamano" | "tipo" | "piso";

const DIMENSION_LABELS: Record<DimensionTab, string> = {
  tamano: "Categoría (Tamaño)",
  tipo: "Categoría (Tipo)",
  piso: "Piso"
};

const compactTheme = getTableTheme("compact");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function valueCls(v: number): string {
  if (v === 0) return "text-slate-300";
  return v < 0 ? "text-red-600" : "text-slate-800";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

export function FacturacionClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [dimension, setDimension] = useState<DimensionTab>("tamano");
  const [breakdown, setBreakdown] = useState(false);

  const [data, setData] = useState<FacturacionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        dimension,
        breakdown: String(breakdown)
      });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/billing?${params}`);
      if (res.ok) {
        setData((await res.json()) as FacturacionResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dimension, breakdown, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const periods = data?.periods ?? [];
  const yearGroups = groupPeriodosByYear(periods);
  const series = data?.series ?? [];
  const totals = data?.totals ?? [];
  const dimensionKeys = series.map((s) => s.dimension);

  // Build chart data
  const chartData = periods.map((p, i) => {
    const entry: Record<string, string | number> = { periodo: p };
    for (const s of series) {
      entry[s.dimension] = s.data[i]?.ufPerM2 ?? 0;
    }
    entry["Total UF/m²"] = totals[i]?.ufPerM2 ?? 0;
    return entry;
  });

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Facturación Mensual (UF/m²)"
        description="Intensidad de facturación por dimensión. Replica la hoja 'Facturación' del CDG."
        valueBadges={["efectivo"]}
        actions={
          <ProjectPeriodToolbar
            desde={desde}
            hasta={hasta}
            onDesdeChange={setDesde}
            onHastaChange={setHasta}
          />
        }
      />

      {/* Controls */}
      <ModuleSectionCard>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Ver por</span>
            {(Object.keys(DIMENSION_LABELS) as DimensionTab[]).map((d) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  dimension === d
                    ? "bg-brand-700 text-white"
                    : "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
                )}
              >
                {DIMENSION_LABELS[d]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={breakdown}
              onChange={(e) => setBreakdown(e.target.checked)}
              className="rounded border-slate-300"
            />
            Desglose por tipo cobro
          </label>
        </div>
      </ModuleSectionCard>

      {/* Content */}
      {loading ? (
        <ModuleLoadingState message="Cargando facturación..." />
      ) : !data || series.length === 0 ? (
        <ModuleEmptyState
          message="Sin datos de facturación para el rango seleccionado."
          actionHref="/imports"
          actionLabel="Cargar datos contables"
        />
      ) : (
        <>
          {/* Chart */}
          <MetricChartCard
            title={`Facturación All-In (UF/m²) por ${DIMENSION_LABELS[dimension]}`}
            metricId="chart_finance_occupancy"
            description="Barras: UF/m² por dimensión. Línea: total UF/m²."
          >
            <ResponsiveContainer width="100%" height={chartHeight.lg}>
              <ComposedChart data={chartData} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
                <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v)} />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => formatPeriodoCorto(String(l))}
                      valueFormatter={(value) => {
                        const v = typeof value === "number" ? value : Number(value ?? 0);
                        return formatUfPerM2(v);
                      }}
                    />
                  }
                />
                <Legend {...chartLegendProps} />
                {dimensionKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={key}
                    fill={getSeriesColor(i)}
                    radius={chartBarRadius}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="Total UF/m²"
                  name="Total UF/m²"
                  stroke={chartColors.axisMuted}
                  strokeDasharray="4 2"
                  dot={false}
                  strokeWidth={1.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* Table */}
          <ModuleSectionCard>
            <UnifiedTable
              density="compact"
              toolbar={
                <p className="text-xs text-slate-400">
                  {series.length} dimensiones · {periods.length} periodos
                </p>
              }
            >
              <table className={`${compactTheme.table} text-xs border-collapse`}>
                <thead className={compactTheme.head}>
                  {yearGroups.length > 1 && (
                    <tr className="bg-brand-700">
                      <th className="sticky left-0 z-10 bg-brand-700 py-0.5 border-r border-white/10" />
                      {yearGroups.map(({ year, count }, idx) => (
                        <th key={year} colSpan={count} className={cn("py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-white/30", idx > 0 && "border-l border-white/15")}>
                          {year}
                        </th>
                      ))}
                    </tr>
                  )}
                  <tr>
                    <th className={cn(compactTheme.headCell, "sticky left-0 z-10 bg-brand-700 pl-4 pr-3 border-r border-white/10")}>
                      {DIMENSION_LABELS[dimension]}
                    </th>
                    {periods.map((p) => (
                      <th key={p} className={cn(compactTheme.compactHeadCell, "min-w-[80px] text-right border-r border-white/10")}>
                        {formatPeriodoCorto(p)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {series.map((s, idx) => (
                    <tr
                      key={s.dimension}
                      className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}
                    >
                      <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
                        {s.dimension}
                      </td>
                      {s.data.map((d) => (
                        <td key={d.period} className={cn("px-2 py-1.5 text-right border-r border-slate-100", valueCls(d.ufPerM2))}>
                          {formatUfPerM2(d.ufPerM2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 border-brand-600 bg-brand-700 text-white hover:bg-brand-700">
                    <td className="sticky left-0 bg-brand-700 py-2 pl-4 pr-3 text-xs font-bold uppercase tracking-wide">
                      Total
                    </td>
                    {totals.map((t) => (
                      <td key={t.period} className="px-2 py-2 text-right text-xs font-bold border-r border-white/15">
                        {formatUfPerM2(t.ufPerM2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </UnifiedTable>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}
