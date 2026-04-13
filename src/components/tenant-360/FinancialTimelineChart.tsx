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
import type { Tenant360MonthlyPoint } from "@/types/tenant-360";

type FinancialTimelineChartProps = {
  data: Tenant360MonthlyPoint[];
};

function fmtUf(value: number): string {
  return value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(value: number | null): string {
  if (value === null) return "\u2014";
  return `${value.toFixed(1)}%`;
}

export function FinancialTimelineChart({ data }: FinancialTimelineChartProps): JSX.Element {
  if (data.length === 0) return <></>;

  return (
    <MetricChartCard
      title="Facturacion vs Ventas"
      metricId="kpi_tenant360_costo_ocupacion_pct"
      description="Evolucion mensual de facturacion, ventas y costo de ocupacion."
    >
      <ResponsiveContainer width="100%" height={320}>
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
            domain={[0, 30]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
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
              if (name === "Costo Ocup. %") return [fmtPct(v), name];
              if (name === "Facturacion (UF)") {
                const entry = props.payload as Tenant360MonthlyPoint | undefined;
                const m2Line = entry?.billingUfM2 != null ? ` (${fmtUf(entry.billingUfM2)} UF/m\u00b2)` : "";
                return [`${fmtUf(v)} UF${m2Line}`, name];
              }
              return [`${fmtUf(v)} UF`, name];
            }}
          />
          <Legend
            verticalAlign="top"
            height={32}
            wrapperStyle={{ fontSize: 11, color: "#64748b" }}
          />
          <ReferenceLine
            yAxisId="right"
            y={15}
            stroke="#e11d48"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: "15%", position: "right", fill: "#e11d48", fontSize: 10 }}
          />
          <Bar
            yAxisId="left"
            dataKey="billingUf"
            name="Facturacion (UF)"
            fill="#2563eb"
            radius={[3, 3, 0, 0]}
            barSize={20}
          />
          <Bar
            yAxisId="left"
            dataKey="salesUf"
            name="Ventas (UF)"
            fill="#10b981"
            radius={[3, 3, 0, 0]}
            barSize={20}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="costoOcupacionPct"
            name="Costo Ocup. %"
            stroke="#e11d48"
            strokeWidth={2}
            dot={{ r: 3, fill: "#e11d48" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </MetricChartCard>
  );
}
