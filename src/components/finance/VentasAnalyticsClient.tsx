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
  getSeriesColor,
} from "@/lib/charts/theme";
import { cn } from "@/lib/utils";
import type { VentasAnalyticsResponse } from "@/types/ventas-analytics";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DimensionTab = "tamano" | "tipo" | "piso";

const DIMENSION_LABELS: Record<DimensionTab, string> = {
  tamano: "Categoria (Tamano)",
  tipo: "Categoria (Tipo)",
  piso: "Piso"
};

const compactTheme = getTableTheme("compact");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUfM2(v: number): string {
  return v.toLocaleString("es-CL", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function valueCls(v: number): string {
  if (v === 0) return "text-slate-300";
  return "text-slate-800";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

export function VentasAnalyticsClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [dimension, setDimension] = useState<DimensionTab>("tamano");

  const [data, setData] = useState<VentasAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        dimension
      });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/finance/ventas-analytics?${params}`);
      if (res.ok) {
        setData((await res.json()) as VentasAnalyticsResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dimension, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const periods = data?.periods ?? [];
  const series = data?.series ?? [];
  const totals = data?.totals ?? [];
  const dimensionKeys = series.map((s) => s.dimension);

  // Build chart data
  const chartData = periods.map((p, i) => {
    const entry: Record<string, string | number> = { mes: p.slice(5) };
    for (const s of series) {
      entry[s.dimension] = s.data[i]?.salesUfPerM2 ?? 0;
    }
    entry["Total UF/m\u00B2"] = totals[i]?.salesUfPerM2 ?? 0;
    return entry;
  });

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Ventas Mensuales (UF/m\u00B2)"
        description="Ventas por dimension de local. Replica la hoja 'Ventas' del CDG."
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
      </ModuleSectionCard>

      {/* Content */}
      {loading ? (
        <ModuleLoadingState message="Cargando ventas..." />
      ) : !data || series.length === 0 ? (
        <ModuleEmptyState
          message="Sin datos de ventas para el rango seleccionado."
          actionHref="/finance/upload"
          actionLabel="Cargar datos de ventas"
        />
      ) : (
        <>
          {/* Chart */}
          <MetricChartCard
            title={`Ventas (UF/m\u00B2) por ${DIMENSION_LABELS[dimension]}`}
            metricId="chart_finance_ventas"
            description="Barras: ventas UF/m\u00B2 por dimension. Linea: total UF/m\u00B2."
          >
            <ResponsiveContainer width="100%" height={chartHeight.lg}>
              <ComposedChart data={chartData} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="mes" {...chartAxisProps} />
                <YAxis {...chartAxisProps} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => `Mes: ${String(l)}`}
                      valueFormatter={(value) => {
                        const v = typeof value === "number" ? value : Number(value ?? 0);
                        return v.toFixed(3);
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
                  dataKey="Total UF/m\u00B2"
                  name="Total UF/m\u00B2"
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
                  {series.length} dimensiones &middot; {periods.length} periodos
                </p>
              }
            >
              <table className={`${compactTheme.table} text-xs`}>
                <thead className={compactTheme.head}>
                  <tr>
                    <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                      {DIMENSION_LABELS[dimension]}
                    </th>
                    {periods.map((p) => (
                      <th key={p} className={`${compactTheme.compactHeadCell} min-w-[80px] text-right`}>
                        {p}
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
                        <td key={d.period} className={cn("px-2 py-1.5 text-right", valueCls(d.salesUfPerM2))}>
                          {fmtUfM2(d.salesUfPerM2)}
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
                      <td key={t.period} className="px-2 py-2 text-right text-xs font-bold">
                        {fmtUfM2(t.salesUfPerM2)}
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
