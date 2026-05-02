"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
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
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  buildPeriodoTickFormatter,
  getSeriesColor
} from "@/lib/charts/theme";
import { cn, formatPeriodoCorto, groupPeriodosByYear } from "@/lib/utils";
import { YearGroupHeaderRow } from "@/components/ui/YearGroupHeaderRow";
import { nullValueCls, formatSalesMetric } from "@/lib/real/sales-format";
import type {
  SalesDimension,
  SalesMetric,
  VentasSeriesPoint,
  VentasTimeseriesResponse
} from "@/types/sales-analytics";

const compactTheme = getTableTheme("compact");

type Props = {
  selectedProjectId: string;
  desde: string;
  hasta: string;
};

function getMetricValue(point: VentasSeriesPoint, metric: SalesMetric, periodTotal: number): number | null {
  if (metric === "uf_m2") return point.salesUfM2;
  if (metric === "uf_total") return point.salesUf;
  if (metric === "share_pct") {
    if (periodTotal <= 0) return null;
    return (point.salesUf / periodTotal) * 100;
  }
  // yoy_pct
  if (point.priorSalesUf === null || point.priorSalesUf === 0) return null;
  return ((point.salesUf - point.priorSalesUf) / Math.abs(point.priorSalesUf)) * 100;
}

export function VentasMensualTab({ selectedProjectId, desde, hasta }: Props): JSX.Element {
  const [dimension, setDimension] = useState<SalesDimension>("tamano");
  const [metric, setMetric] = useState<SalesMetric>("uf_m2");
  const [data, setData] = useState<VentasTimeseriesResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        dimension,
        mode: "timeseries"
      });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/sales-analytics?${params}`);
      if (res.ok) {
        const json = (await res.json()) as VentasTimeseriesResponse;
        if (json.mode === "timeseries") setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dimension, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const periods = useMemo(() => data?.periods ?? [], [data]);
  const series = useMemo(() => data?.series ?? [], [data]);
  const totals = useMemo(() => data?.totals ?? [], [data]);
  const dimensionKeys = series.map((s) => s.dimension);

  const periodTotalsUf = useMemo(() => totals.map((t) => t.salesUf), [totals]);
  const yearGroups = useMemo(() => groupPeriodosByYear(periods), [periods]);

  // chart32: last-period bar chart by category
  const lastPeriodIdx = periods.length - 1;
  const lastPeriodBarData = useMemo(() => {
    if (lastPeriodIdx < 0) return [];
    const totalUf = periodTotalsUf[lastPeriodIdx] ?? 0;
    return series
      .map((s) => {
        const point = s.data[lastPeriodIdx] ?? emptyPoint(periods[lastPeriodIdx] ?? "");
        const v = getMetricValue(point, metric, totalUf);
        return { dimension: s.dimension, value: v };
      })
      .filter((d) => d.value !== null && d.value !== 0);
  }, [series, lastPeriodIdx, periodTotalsUf, periods, metric]);

  const chartData = useMemo(() => {
    return periods.map((p, i) => {
      const entry: Record<string, string | number | null> = { periodo: p };
      for (const s of series) {
        entry[s.dimension] = getMetricValue(s.data[i] ?? emptyPoint(p), metric, periodTotalsUf[i] ?? 0);
      }
      const totalPoint = totals[i] ?? emptyPoint(p);
      entry["Total"] = getMetricValue(totalPoint, metric, periodTotalsUf[i] ?? 0);
      return entry;
    });
  }, [periods, series, totals, metric, periodTotalsUf]);

  if (loading && !data) {
    return <ModuleLoadingState message="Cargando ventas..." />;
  }
  if (!data || series.length === 0) {
    return (
      <ModuleEmptyState
        message="Sin datos de ventas para el rango seleccionado."
        actionHref="/imports"
        actionLabel="Cargar datos de ventas"
      />
    );
  }

  return (
    <div className="space-y-4">
      <ModuleSectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <VentasDimensionSelect
            value={dimension}
            onChange={setDimension}
            label="Dimensión"
          />
          <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
          <VentasMetricToggle value={metric} onChange={setMetric} />
        </div>
      </ModuleSectionCard>

      {/* chart32 — Ventas del último mes por categoría */}
      {lastPeriodBarData.length > 0 && (
        <MetricChartCard
          title={`${METRIC_LABELS[metric]} por ${SALES_DIMENSION_LABELS[dimension]} · ${periods[lastPeriodIdx] ?? ""}`}
          metricId="chart_ventas_ultimo_mes"
          description={`Ventas del último período disponible por ${SALES_DIMENSION_LABELS[dimension].toLowerCase()}.`}
        >
          <ResponsiveContainer width="100%" height={chartHeight.sm}>
            <ComposedChart data={lastPeriodBarData} margin={chartMargins.default}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="dimension" {...chartAxisProps} />
              <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatSalesMetric(v, metric)} />
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
              <Bar
                dataKey="value"
                name={METRIC_LABELS[metric]}
                fill={chartColors.brandPrimary}
                radius={chartBarRadius}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </MetricChartCard>
      )}

      <MetricChartCard
        title={`${METRIC_LABELS[metric]} por ${SALES_DIMENSION_LABELS[dimension]}`}
        metricId="chart_finance_ventas"
        description="Barras: ventas por dimensión. Línea: total."
      >
        <ResponsiveContainer width="100%" height={chartHeight.lg}>
          <ComposedChart data={chartData} margin={chartMargins.default}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
            <YAxis
              {...chartAxisProps}
              tickFormatter={(v: number) => formatSalesMetric(v, metric)}
            />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(l) => formatPeriodoCorto(String(l))}
                  valueFormatter={(value) => {
                    const v = typeof value === "number" ? value : Number(value ?? 0);
                    return formatSalesMetric(v, metric);
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
              dataKey="Total"
              name="Total"
              stroke={chartColors.axisMuted}
              strokeDasharray="4 2"
              dot={false}
              strokeWidth={1.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </MetricChartCard>

      <ModuleSectionCard>
        <UnifiedTable
          density="compact"
          toolbar={
            <p className="text-xs text-slate-400">
              {series.length} dimensiones · {periods.length} periodos · {METRIC_LABELS[metric]}
            </p>
          }
        >
          <table className={`${compactTheme.table} text-xs border-collapse`}>
            <thead className={compactTheme.head}>
              <YearGroupHeaderRow yearGroups={yearGroups} />
              <tr>
                <th className={cn(compactTheme.headCell, "sticky left-0 z-10 bg-brand-700 pl-4 pr-3 border-r border-white/10")}>
                  {SALES_DIMENSION_LABELS[dimension]}
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
                  {s.data.map((d, i) => {
                    const v = getMetricValue(d, metric, periodTotalsUf[i] ?? 0);
                    return (
                      <td
                        key={d.period}
                        className={cn("px-2 py-1.5 text-right border-r border-slate-100", nullValueCls(v))}
                      >
                        {formatSalesMetric(v, metric)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-brand-600 bg-brand-700 text-white hover:bg-brand-700">
                <td className="sticky left-0 bg-brand-700 py-2 pl-4 pr-3 text-xs font-bold uppercase tracking-wide">
                  Total
                </td>
                {totals.map((t, i) => {
                  const v = getMetricValue(t, metric, periodTotalsUf[i] ?? 0);
                  return (
                    <td key={t.period} className="px-2 py-2 text-right text-xs font-bold border-r border-white/15">
                      {formatSalesMetric(v, metric)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </UnifiedTable>
      </ModuleSectionCard>
    </div>
  );
}

function emptyPoint(period: string): VentasSeriesPoint {
  return {
    period,
    salesPesos: 0,
    salesUf: 0,
    glaM2: 0,
    salesPesosM2: 0,
    salesUfM2: 0,
    priorSalesUf: null
  };
}
