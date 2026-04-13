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
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmtUf(v)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
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
            formatter={(value, name, props) => {
              const v = typeof value === "number" ? value : Number(value ?? 0);
              if (name === "Ventas (UF)") {
                const entry = props.payload as Tenant360SalesPoint | undefined;
                const clpLine = entry?.salesClp != null ? ` (${fmtClp(entry.salesClp)})` : "";
                return [`${fmtUf(v)} UF${clpLine}`, name];
              }
              return [`${fmtUf(v)} UF`, name];
            }}
          />
          <Legend
            verticalAlign="top"
            height={32}
            wrapperStyle={{ fontSize: 11, color: "#64748b" }}
          />
          <Bar
            yAxisId="left"
            dataKey="salesUf"
            name="Ventas (UF)"
            fill="#60a5fa"
            radius={[3, 3, 0, 0]}
            barSize={24}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="salesPerM2"
            name="Ventas/m\u00b2 (UF)"
            stroke="#eab308"
            strokeWidth={2}
            dot={{ r: 3, fill: "#eab308" }}
          />
          {data.some((d) => d.variableRentUf > 0) ? (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="variableRentUf"
              name="Renta Variable (UF)"
              stroke="#8b5cf6"
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
