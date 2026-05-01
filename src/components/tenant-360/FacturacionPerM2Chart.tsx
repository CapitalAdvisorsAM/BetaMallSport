"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import { formatPeriodoCorto, formatUf } from "@/lib/utils";
import type { Tenant360MonthlyPoint, Tenant360SalesPoint } from "@/types/tenant-360";

type FacturacionPerM2ChartProps = {
  monthlyData: Tenant360MonthlyPoint[];
  salesData: Tenant360SalesPoint[];
};

type ChartPoint = {
  period: string;
  billingUfM2: number | null;
  salesPerM2: number;
};

export function FacturacionPerM2Chart({ monthlyData, salesData }: FacturacionPerM2ChartProps): JSX.Element {
  const chartData = useMemo<ChartPoint[]>(() => {
    const salesMap = new Map<string, number>();
    for (const s of salesData) {
      salesMap.set(s.period, s.salesPerM2);
    }

    return monthlyData.map((m) => ({
      period: m.period,
      billingUfM2: m.billingUfM2,
      salesPerM2: salesMap.get(m.period) ?? 0
    }));
  }, [monthlyData, salesData]);

  const hasData = chartData.some((p) => (p.billingUfM2 ?? 0) > 0 || p.salesPerM2 > 0);
  if (!hasData) return <></>;

  return (
    <MetricChartCard
      title="Facturacion vs Ventas por m²"
      metricId="kpi_tenant360_facturacion_uf_m2"
      description="Evolucion mensual normalizada por metro cuadrado arrendado."
    >
      <ResponsiveContainer width="100%" height={chartHeight.md}>
        <LineChart data={chartData} margin={chartMargins.default}>
          <CartesianGrid {...chartGridProps} />
          <XAxis
            dataKey="period"
            {...chartAxisProps}
            tickFormatter={buildPeriodoTickFormatter(chartData.length)}
          />
          <YAxis
            {...chartAxisProps}
            tickFormatter={(v: number) => formatUf(v)}
          />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(l) => formatPeriodoCorto(String(l))}
                valueFormatter={(value) =>
                  `${formatUf(typeof value === "number" ? value : Number(value ?? 0))} UF/m\u00b2`
                }
              />
            }
          />
          <Legend verticalAlign="top" height={32} {...chartLegendProps} />
          <Line
            type="monotone"
            dataKey="billingUfM2"
            name="Facturacion/m²"
            stroke={chartColors.brandPrimary}
            strokeWidth={2}
            dot={{ r: 3, fill: chartColors.brandPrimary }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="salesPerM2"
            name="Ventas/m²"
            stroke={chartColors.positiveLight}
            strokeWidth={2}
            dot={{ r: 3, fill: chartColors.positiveLight }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </MetricChartCard>
  );
}
