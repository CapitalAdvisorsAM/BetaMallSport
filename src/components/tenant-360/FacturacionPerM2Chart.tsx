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

function fmtUf(value: number): string {
  return value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
      title="Facturacion vs Ventas por m\u00b2"
      metricId="kpi_tenant360_facturacion_uf_m2"
      description="Evolucion mensual normalizada por metro cuadrado arrendado."
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmtUf(v)}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
            }}
            formatter={(value, name) => [
              `${fmtUf(typeof value === "number" ? value : Number(value ?? 0))} UF/m\u00b2`,
              name
            ]}
          />
          <Legend
            verticalAlign="top"
            height={32}
            wrapperStyle={{ fontSize: 11, color: "#64748b" }}
          />
          <Line
            type="monotone"
            dataKey="billingUfM2"
            name="Facturacion/m\u00b2"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3, fill: "#2563eb" }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="salesPerM2"
            name="Ventas/m\u00b2"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: "#10b981" }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </MetricChartCard>
  );
}
