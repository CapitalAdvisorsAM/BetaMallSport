"use client";

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
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  buildPeriodoTickFormatter,
  chartAxisProps,
  chartBarRadius,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  getSeriesColor
} from "@/lib/charts/theme";
import { formatPeriodoCorto, formatUfPerM2 } from "@/lib/utils";
import type { FacturacionResponse } from "@/types/billing";

type Props = {
  data: FacturacionResponse;
};

export function FacturacionAllInChart({ data }: Props): JSX.Element | null {
  const { periods, series, totals } = data;

  // For each period, build a bar per group3 breakdown within each dimension.
  // We pivot so X = period, stacks = group3 keys.
  // Pull available group3 keys from any series point that has breakdown.
  const group3Keys = data.availableGroup3;

  if (series.length === 0 || group3Keys.length === 0) return null;

  // Chart: per dimension (tamano), show stacked group3 breakdown over time.
  // We show one chart per dimension, or a single chart with total stacked.
  // For simplicity, show the aggregate stacked chart (totals × breakdown).
  // Recompute breakdown totals across all dimensions.
  const chartData = periods.map((p, i) => {
    const entry: Record<string, string | number> = { periodo: p };
    for (const g3 of group3Keys) {
      let g3Sum = 0;
      for (const s of series) {
        const pt = s.data[i];
        g3Sum += pt?.breakdown?.[g3] ?? 0;
      }
      // Average across dimension count that have this breakdown
      const dimCount = series.filter((s) => (s.data[i]?.breakdown?.[g3] ?? 0) > 0).length || 1;
      entry[g3] = g3Sum / dimCount;
    }
    entry["Total UF/m²"] = totals[i]?.ufPerM2 ?? 0;
    return entry;
  });

  return (
    <MetricChartCard
      title="Breakdown All-In del Arrendatario (UF/m²)"
      metricId="chart_allin_breakdown"
      description="Desglose del total UF/m² facturado por tipo de cobro (arriendo fijo, variable, GG.CC., otros)."
    >
      <ResponsiveContainer width="100%" height={chartHeight.lg}>
        <ComposedChart data={chartData} margin={chartMargins.default}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
          <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUfPerM2(v)} />
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
          {group3Keys.map((g3, i) => (
            <Bar
              key={g3}
              dataKey={g3}
              name={g3}
              stackId="allin"
              fill={getSeriesColor(i)}
              radius={i === group3Keys.length - 1 ? chartBarRadius : [0, 0, 0, 0]}
              maxBarSize={20}
            />
          ))}
          <Line
            type="natural"
            dataKey="Total UF/m²"
            name="Total UF/m²"
            stroke="#011E42"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 2"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </MetricChartCard>
  );
}
