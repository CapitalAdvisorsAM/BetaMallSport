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
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  getSeriesColor,
} from "@/lib/charts/theme";
import type { Tenant360SalesPoint } from "@/types/tenant-360";

type SalesPerformanceSectionProps = {
  data: Tenant360SalesPoint[];
};

function fmtUf(value: number): string {
  return value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtClp(value: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export function SalesPerformanceSection({ data }: SalesPerformanceSectionProps): JSX.Element {
  if (data.length === 0) return <></>;

  return (
    <MetricChartCard
      title="Ventas"
      metricId="kpi_tenant360_ventas_promedio_uf"
      description="Ventas mensuales y ventas por m2."
    >
      <ResponsiveContainer width="100%" height={chartHeight.md}>
        <ComposedChart data={data} margin={chartMargins.default}>
          <CartesianGrid {...chartGridProps} />
          <XAxis
            dataKey="period"
            {...chartAxisProps}
          />
          <YAxis
            yAxisId="left"
            {...chartAxisProps}
            tickFormatter={(v: number) => fmtUf(v)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            {...chartAxisProps}
            tickFormatter={(v: number) => fmtUf(v)}
          />
          <Tooltip
            content={
              <ChartTooltip
                valueFormatter={(value, name, entry) => {
                  const v = typeof value === "number" ? value : Number(value ?? 0);
                  if (String(name) === "Ventas (UF)") {
                    const payload = entry as Tenant360SalesPoint | undefined;
                    const clpLine = payload?.salesClp != null ? ` (${fmtClp(payload.salesClp)})` : "";
                    return `${fmtUf(v)} UF${clpLine}`;
                  }
                  return `${fmtUf(v)} UF`;
                }}
              />
            }
          />
          <Legend verticalAlign="top" height={32} {...chartLegendProps} />
          <Bar
            yAxisId="left"
            dataKey="salesUf"
            name="Ventas (UF)"
            fill={chartColors.brandLight}
            radius={[3, 3, 0, 0]}
            barSize={24}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="salesPerM2"
            name="Ventas/m\u00b2 (UF)"
            stroke={chartColors.gold}
            strokeWidth={2}
            dot={{ r: 3, fill: chartColors.gold }}
          />
          {data.some((d) => d.variableRentUf > 0) ? (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="variableRentUf"
              name="Renta Variable (UF)"
              stroke={getSeriesColor(4)}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </MetricChartCard>
  );
}
