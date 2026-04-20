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
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  getSeriesColor,
} from "@/lib/charts/theme";
import { cn, formatPercent, formatUf } from "@/lib/utils";
import type {
  OccupancyDimensionRow,
  OccupancyTimeSeriesResponse
} from "@/types/occupancy";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DimensionTab = "tipo" | "tamano" | "piso";

const DIMENSION_LABELS: Record<DimensionTab, string> = {
  tipo: "Categoría (Tipo)",
  tamano: "Categoría (Tamaño)",
  piso: "Piso"
};

const compactTheme = getTableTheme("compact");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function vacancyColorCls(pct: number): string {
  if (pct <= 5) return "text-emerald-700";
  if (pct <= 15) return "text-amber-700";
  return "text-red-700";
}

function getRowsForDimension(
  snapshot: { byType: OccupancyDimensionRow[]; bySize: OccupancyDimensionRow[]; byFloor: OccupancyDimensionRow[] },
  dim: DimensionTab
): OccupancyDimensionRow[] {
  if (dim === "tipo") return snapshot.byType;
  if (dim === "tamano") return snapshot.bySize;
  return snapshot.byFloor;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OccupancyClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [dimension, setDimension] = useState<DimensionTab>("tamano");

  const [data, setData] = useState<OccupancyTimeSeriesResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/finance/occupancy?${params}`);
      if (res.ok) {
        setData((await res.json()) as OccupancyTimeSeriesResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Derive current snapshot (last period) and dimension labels for chart
  const snapshots = data?.snapshots ?? [];
  const lastSnapshot = snapshots[snapshots.length - 1] ?? null;
  const currentRows = lastSnapshot ? getRowsForDimension(lastSnapshot, dimension) : [];
  const totals = lastSnapshot?.totals ?? null;

  // Collect all unique dimension values across all snapshots for chart series
  const allDimensions = new Set<string>();
  for (const snap of snapshots) {
    for (const row of getRowsForDimension(snap, dimension)) {
      allDimensions.add(row.dimension);
    }
  }
  const dimensionKeys = [...allDimensions];

  // Build chart data
  const chartData = snapshots.map((snap) => {
    const rows = getRowsForDimension(snap, dimension);
    const entry: Record<string, string | number> = { mes: snap.period.slice(5) };
    for (const key of dimensionKeys) {
      const row = rows.find((r) => r.dimension === key);
      entry[key] = row ? row.glaOcupada : 0;
    }
    entry["Vacancia %"] = snap.totals.pctVacancia;
    return entry;
  });

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Ocupación Mensual"
        description="Evolución de la ocupación por tipo, tamaño y piso. Replica la hoja 'Ocupación' del CDG."
        actions={
          <ProjectPeriodToolbar
            desde={desde}
            hasta={hasta}
            onDesdeChange={setDesde}
            onHastaChange={setHasta}
          />
        }
      />

      {/* Dimension tabs */}
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
        <ModuleLoadingState message="Cargando ocupación..." />
      ) : !data || snapshots.length === 0 ? (
        <ModuleEmptyState
          message="Sin datos de ocupación para el rango seleccionado."
          actionHref="/rent-roll/contracts"
          actionLabel="Gestionar contratos"
        />
      ) : (
        <>
          {/* Chart */}
          <MetricChartCard
            title={`Ocupación por ${DIMENSION_LABELS[dimension]}`}
            metricId="chart_finance_occupancy"
            description="Barras: GLA ocupada por dimensión (m²). Línea: vacancia total (%)."
          >
            <ResponsiveContainer width="100%" height={chartHeight.lg}>
              <ComposedChart data={chartData} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="mes" {...chartAxisProps} />
                <YAxis yAxisId="left" {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...chartAxisProps}
                  tickFormatter={(v: number) => formatPercent(v)}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => `Mes: ${String(l)}`}
                      valueFormatter={(value, name) => {
                        const v = typeof value === "number" ? value : Number(value ?? 0);
                        return String(name) === "Vacancia %" ? formatPercent(v) : formatUf(v, 0);
                      }}
                    />
                  }
                />
                <Legend {...chartLegendProps} />
                {dimensionKeys.map((key, i) => (
                  <Bar
                    key={key}
                    yAxisId="left"
                    dataKey={key}
                    name={key}
                    stackId="gla"
                    fill={getSeriesColor(i)}
                  />
                ))}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Vacancia %"
                  name="Vacancia %"
                  stroke={chartColors.negative}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* Current snapshot table */}
          <ModuleSectionCard>
            <UnifiedTable
              density="compact"
              toolbar={
                <p className="text-xs text-slate-400">
                  Periodo: {lastSnapshot?.period ?? "–"} · {currentRows.length} dimensiones
                </p>
              }
            >
              <table className={`${compactTheme.table} text-xs`}>
                <thead className={compactTheme.head}>
                  <tr>
                    <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                      {DIMENSION_LABELS[dimension]}
                    </th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>GLA Total (m²)</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>GLA Ocupada (m²)</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>GLA Vacante (m²)</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Vacancia (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentRows.map((row, idx) => (
                    <tr
                      key={row.dimension}
                      className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}
                    >
                      <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
                        {row.dimension}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-600">{formatUf(row.glaTotal)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600">{formatUf(row.glaOcupada)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600">{formatUf(row.glaVacante)}</td>
                      <td className={cn("px-2 py-1.5 text-right font-semibold", vacancyColorCls(row.pctVacancia))}>
                        {formatPercent(row.pctVacancia)}
                      </td>
                    </tr>
                  ))}
                  {totals ? (
                    <tr className="border-t-2 border-brand-600 bg-brand-700 text-white hover:bg-brand-700">
                      <td className="sticky left-0 bg-brand-700 py-2 pl-4 pr-3 text-xs font-bold uppercase tracking-wide">
                        Total
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-bold">{formatUf(totals.glaTotal)}</td>
                      <td className="px-2 py-2 text-right text-xs font-bold">{formatUf(totals.glaOcupada)}</td>
                      <td className="px-2 py-2 text-right text-xs font-bold">{formatUf(totals.glaVacante)}</td>
                      <td className="px-2 py-2 text-right text-xs font-bold">{formatPercent(totals.pctVacancia)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </UnifiedTable>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}
