"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import {
  SALES_DIMENSION_LABELS,
  VentasDimensionSelect
} from "@/components/real/sales/VentasDimensionSelect";
import {
  METRIC_LABELS,
  VentasMetricToggle
} from "@/components/real/sales/VentasMetricToggle";
import {
  chartAxisProps,
  chartBarRadius,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  getSeriesColor
} from "@/lib/charts/theme";
import { cn } from "@/lib/utils";
import { nullValueCls, formatSalesMetric } from "@/lib/real/sales-format";
import type {
  SalesDimension,
  SalesMetric,
  VentasCrosstabCell,
  VentasCrosstabResponse
} from "@/types/sales-analytics";

const compactTheme = getTableTheme("compact");

const ALL_PERIODS_VALUE = "__ALL__";

type Props = {
  selectedProjectId: string;
  desde: string;
  hasta: string;
};

function getCellValue(cell: VentasCrosstabCell, metric: SalesMetric): number | null {
  if (metric === "uf_m2") return cell.ufPerM2;
  if (metric === "uf_total") return cell.salesUf;
  if (metric === "share_pct") return cell.sharePct;
  return cell.yoyPct;
}

function listPeriodsBetween(desde: string, hasta: string): string[] {
  if (!desde || !hasta) return [];
  const out: string[] = [];
  const start = new Date(`${desde}-01T00:00:00Z`);
  const end = new Date(`${hasta}-01T00:00:00Z`);
  const cur = new Date(start);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 7));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

export function VentasCruceTab({ selectedProjectId, desde, hasta }: Props): JSX.Element {
  const [rowDim, setRowDim] = useState<SalesDimension>("tamano");
  const [colDim, setColDim] = useState<SalesDimension>("piso");
  const [metric, setMetric] = useState<SalesMetric>("uf_m2");
  const [periodSelection, setPeriodSelection] = useState<string>(ALL_PERIODS_VALUE);
  const [data, setData] = useState<VentasCrosstabResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const periodOptions = useMemo(() => listPeriodsBetween(desde, hasta), [desde, hasta]);

  const fetchData = useCallback(async () => {
    if (rowDim === colDim) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        mode: "crosstab",
        rowDim,
        colDim
      });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      if (periodSelection !== ALL_PERIODS_VALUE) {
        params.set("period", periodSelection);
      }
      const res = await fetch(`/api/real/sales-analytics?${params}`);
      if (res.ok) {
        const json = (await res.json()) as VentasCrosstabResponse;
        if (json.mode === "crosstab") setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, rowDim, colDim, desde, hasta, periodSelection]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // chart33: grouped bar chart data from crosstab
  const crossChartData = useMemo(() => {
    if (!data) return [];
    return data.rows.map((r, ri) => {
      const entry: Record<string, string | number | null> = { row: r };
      for (const [ci, col] of data.cols.entries()) {
        const v = getCellValue(data.cells[ri]?.[ci] ?? { salesUf: 0, ufPerM2: 0, sharePct: null, yoyPct: null }, metric);
        entry[col] = v;
      }
      return entry;
    });
  }, [data, metric]);

  return (
    <div className="space-y-4">
      <ModuleSectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <VentasDimensionSelect
            value={rowDim}
            onChange={setRowDim}
            label="Filas"
            exclude={colDim}
          />
          <VentasDimensionSelect
            value={colDim}
            onChange={setColDim}
            label="Columnas"
            exclude={rowDim}
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">Período</span>
            <select
              value={periodSelection}
              onChange={(e) => setPeriodSelection(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value={ALL_PERIODS_VALUE}>Período seleccionado (suma)</option>
              {periodOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
          <VentasMetricToggle value={metric} onChange={setMetric} />
        </div>
      </ModuleSectionCard>

      {rowDim === colDim ? (
        <ModuleEmptyState message="Selecciona dos dimensiones distintas para Filas y Columnas." />
      ) : loading && !data ? (
        <ModuleLoadingState message="Calculando cruce..." />
      ) : !data || data.rows.length === 0 ? (
        <ModuleEmptyState message="Sin datos para el cruce seleccionado." />
      ) : (
        <>
          {/* chart33 — Ventas Tipo × Piso (UF/m²) grouped bar chart */}
          {crossChartData.length > 0 && (
            <MetricChartCard
              title={`${METRIC_LABELS[metric]}: ${SALES_DIMENSION_LABELS[data.rowDim]} × ${SALES_DIMENSION_LABELS[data.colDim]}`}
              metricId="chart_ventas_cruce"
              description="Barras agrupadas por dimensión de columna para cada valor de la dimensión de fila."
            >
              <ResponsiveContainer width="100%" height={chartHeight.md}>
                <ComposedChart data={crossChartData} margin={chartMargins.default}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="row" {...chartAxisProps} />
                  <YAxis
                    {...chartAxisProps}
                    tickFormatter={(v: number) => formatSalesMetric(v, metric)}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => String(l)}
                        valueFormatter={(value) => {
                          const v = typeof value === "number" ? value : Number(value ?? 0);
                          return formatSalesMetric(v, metric);
                        }}
                      />
                    }
                  />
                  <Legend {...chartLegendProps} />
                  {data.cols.map((col, i) => (
                    <Bar
                      key={col}
                      dataKey={col}
                      name={col}
                      fill={getSeriesColor(i)}
                      radius={chartBarRadius}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </MetricChartCard>
          )}

          <ModuleSectionCard>
          <UnifiedTable
            density="compact"
            toolbar={
              <p className="text-xs text-slate-400">
                {data.rows.length} filas × {data.cols.length} columnas · {METRIC_LABELS[metric]} ·{" "}
                {periodSelection === ALL_PERIODS_VALUE
                  ? `${periodOptions.length} periodo(s) sumados`
                  : `Periodo ${periodSelection}`}
              </p>
            }
          >
            <table className={`${compactTheme.table} text-xs`}>
              <thead className={compactTheme.head}>
                <tr>
                  <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                    {SALES_DIMENSION_LABELS[data.rowDim]} ↓ / {SALES_DIMENSION_LABELS[data.colDim]} →
                  </th>
                  {data.cols.map((c) => (
                    <th key={c} className={`${compactTheme.compactHeadCell} min-w-[90px] text-right`}>
                      {c}
                    </th>
                  ))}
                  <th className={`${compactTheme.compactHeadCell} min-w-[90px] text-right bg-brand-800`}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r, ri) => (
                  <tr
                    key={r}
                    className={`${getStripedRowClass(ri, "compact")} ${compactTheme.rowHover}`}
                  >
                    <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
                      {r}
                    </td>
                    {data.cells[ri].map((cell, ci) => {
                      const v = getCellValue(cell, metric);
                      return (
                        <td key={ci} className={cn("px-2 py-1.5 text-right", nullValueCls(v))}>
                          {formatSalesMetric(v, metric)}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-800">
                      {formatSalesMetric(getCellValue(data.rowTotals[ri], metric), metric)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-brand-600 bg-brand-700 text-white">
                  <td className="sticky left-0 bg-brand-700 py-2 pl-4 pr-3 text-xs font-bold uppercase tracking-wide">
                    Total
                  </td>
                  {data.colTotals.map((t, ci) => (
                    <td key={ci} className="px-2 py-2 text-right text-xs font-bold">
                      {formatSalesMetric(getCellValue(t, metric), metric)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right text-xs font-bold">
                    {formatSalesMetric(getCellValue(data.grandTotal, metric), metric)}
                  </td>
                </tr>
              </tbody>
            </table>
          </UnifiedTable>
        </ModuleSectionCard>
        </>
      )}
    </div>
  );
}
