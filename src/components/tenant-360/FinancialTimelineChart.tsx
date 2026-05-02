"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  buildPeriodoTickFormatter,
} from "@/lib/charts/theme";
import { formatPercent, formatPeriodoCorto, formatUf } from "@/lib/utils";
import type { Tenant360MonthlyPoint } from "@/types/tenant-360";

type FinancialTimelineChartProps = {
  data: Tenant360MonthlyPoint[];
};

export function FinancialTimelineChart({ data }: FinancialTimelineChartProps): JSX.Element {
  if (data.length === 0) return <></>;

  return (
    <MetricChartCard
      title="Facturacion vs Ventas"
      metricId="kpi_tenant360_costo_ocupacion_pct"
      description="Evolucion mensual de facturacion, ventas y costo de ocupacion."
    >
      <ResponsiveContainer width="100%" height={chartHeight.lg}>
        <ComposedChart data={data} margin={chartMargins.default}>
          <CartesianGrid {...chartGridProps} />
          <XAxis
            dataKey="period"
            {...chartAxisProps}
            tickFormatter={buildPeriodoTickFormatter(data.length)}
          />
          <YAxis
            yAxisId="left"
            {...chartAxisProps}
            tickFormatter={(v: number) => formatUf(v)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 30]}
            {...chartAxisProps}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(l) => formatPeriodoCorto(String(l))}
                valueFormatter={(value, name, entry) => {
                  const v = typeof value === "number" ? value : Number(value ?? 0);
                  if (String(name) === "Costo Ocup. %") return formatPercent(v);
                  if (String(name) === "Facturacion (UF)") {
                    const payload = entry as Tenant360MonthlyPoint | undefined;
                    const m2Line = payload?.billingUfM2 != null ? ` (${formatUf(payload.billingUfM2)} UF/m\u00b2)` : "";
                    return `${formatUf(v)} UF${m2Line}`;
                  }
                  return `${formatUf(v)} UF`;
                }}
              />
            }
          />
          <Legend verticalAlign="top" height={32} {...chartLegendProps} />
          <ReferenceLine
            yAxisId="right"
            y={15}
            stroke={chartColors.negative}
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: "15%", position: "right", fill: chartColors.negative, fontSize: 10 }}
          />
          <Bar
            yAxisId="left"
            dataKey="billingUf"
            name="Facturacion (UF)"
            fill={chartColors.brandPrimary}
            radius={[3, 3, 0, 0]}
            barSize={20}
          />
          <Bar
            yAxisId="left"
            dataKey="salesUf"
            name="Ventas (UF)"
            fill={chartColors.positiveLight}
            radius={[3, 3, 0, 0]}
            barSize={20}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="costoOcupacionPct"
            name="Costo Ocup. %"
            stroke={chartColors.negative}
            strokeWidth={2}
            dot={{ r: 3, fill: chartColors.negative }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </MetricChartCard>
  );
}
