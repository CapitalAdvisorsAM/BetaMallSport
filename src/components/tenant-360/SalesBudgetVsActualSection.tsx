"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ColumnDef } from "@tanstack/react-table";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import {
  chartAxisProps,
  chartBarRadius,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  chartSeriesColors,
  buildPeriodoTickFormatter,
} from "@/lib/charts/theme";
import { formatUf, formatPercent, formatPeriodoCorto } from "@/lib/utils";
import type { Tenant360BudgetSalesPoint } from "@/types/tenant-360";

type Props = {
  data: Tenant360BudgetSalesPoint[];
};

const columns: ColumnDef<Tenant360BudgetSalesPoint>[] = [
  {
    accessorKey: "period",
    header: "Periodo",
    cell: ({ getValue }) => formatPeriodoCorto(String(getValue())),
    meta: { filterType: "string" },
  },
  {
    accessorKey: "actualSalesUf",
    header: "Ventas Reales (UF)",
    filterFn: "inNumberRange",
    cell: ({ getValue }) => `${formatUf(Number(getValue()))} UF`,
    meta: { align: "right", filterType: "number" },
  },
  {
    accessorKey: "budgetedSalesUf",
    header: "Ventas Presupuestadas (UF)",
    filterFn: "inNumberRange",
    cell: ({ getValue }) => {
      const v = Number(getValue());
      return v > 0 ? `${formatUf(v)} UF` : "—";
    },
    meta: { align: "right", filterType: "number" },
  },
  {
    accessorKey: "varianceUf",
    header: "Varianza (UF)",
    filterFn: "inNumberRange",
    cell: ({ getValue }) => {
      const v = Number(getValue());
      const formatted = `${formatUf(Math.abs(v))} UF`;
      if (v > 0) return <span className="text-emerald-700">+{formatted}</span>;
      if (v < 0) return <span className="text-rose-600">−{formatted}</span>;
      return "—";
    },
    meta: { align: "right", filterType: "number" },
  },
  {
    accessorKey: "variancePct",
    header: "Cumplimiento",
    filterFn: "inNumberRange",
    cell: ({ getValue }) => {
      const v = getValue();
      if (v === null || v === undefined) return "—";
      const pct = Number(v);
      const cumplimiento = 100 + pct;
      const formatted = formatPercent(cumplimiento, 1);
      if (cumplimiento >= 100) return <span className="text-emerald-700">{formatted}</span>;
      if (cumplimiento >= 85) return <span className="text-amber-600">{formatted}</span>;
      return <span className="text-rose-600">{formatted}</span>;
    },
    meta: { align: "right", filterType: "number" },
  },
];

export function SalesBudgetVsActualSection({ data }: Props): JSX.Element {
  const hasBudget = data.some((p) => p.budgetedSalesUf > 0);
  const { table } = useDataTable(data, columns);

  const kpis = useMemo(() => {
    const totalActual = data.reduce((s, p) => s + p.actualSalesUf, 0);
    const totalBudget = data.reduce((s, p) => s + p.budgetedSalesUf, 0);
    const cumplimientoPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : null;

    const periodsWithBoth = data.filter((p) => p.budgetedSalesUf > 0 && p.actualSalesUf > 0);
    const bestMonth = periodsWithBoth.reduce<Tenant360BudgetSalesPoint | null>(
      (best, p) => (best === null || p.variancePct! > best.variancePct! ? p : best),
      null
    );

    return { totalActual, totalBudget, cumplimientoPct, bestMonth };
  }, [data]);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Ventas Reales (Acumulado)"
          value={`${formatUf(kpis.totalActual)} UF`}
          subtitle="Total en el periodo seleccionado"
          accent="slate"
        />
        <KpiCard
          title="Ventas Presupuestadas (Acumulado)"
          value={hasBudget ? `${formatUf(kpis.totalBudget)} UF` : "Sin presupuesto"}
          subtitle="Total en el periodo seleccionado"
          accent="slate"
        />
        <KpiCard
          title="% Cumplimiento"
          value={kpis.cumplimientoPct !== null ? formatPercent(kpis.cumplimientoPct, 1) : "—"}
          subtitle={
            kpis.bestMonth
              ? `Mejor mes: ${formatPeriodoCorto(kpis.bestMonth.period)}`
              : "Sin presupuesto cargado"
          }
          accent={
            kpis.cumplimientoPct === null ? "slate"
            : kpis.cumplimientoPct >= 100 ? "green"
            : kpis.cumplimientoPct >= 85 ? "yellow"
            : "red"
          }
          trend={
            kpis.cumplimientoPct !== null
              ? { value: kpis.cumplimientoPct - 100, label: "vs presupuesto" }
              : undefined
          }
        />
      </div>

      {/* Chart */}
      <MetricChartCard
        title="Ventas Reales vs Presupuestadas"
        metricId="chart_bva_mensual"
        description={
          hasBudget
            ? "Comparativo mensual de ventas efectivas (barras) y presupuestadas (línea)."
            : "No hay presupuesto de ventas cargado para este periodo."
        }
      >
        {data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
            Sin datos para graficar.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight.md}>
            <ComposedChart data={data} margin={chartMargins.withLegend}>
              <CartesianGrid {...chartGridProps} />
              <XAxis
                dataKey="period"
                {...chartAxisProps}
                tickFormatter={buildPeriodoTickFormatter(data.length)}
              />
              <YAxis
                {...chartAxisProps}
                tickFormatter={(v: number) => formatUf(v)}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => formatPeriodoCorto(String(l))}
                    valueFormatter={(value) => `${formatUf(Number(value ?? 0))} UF`}
                  />
                }
              />
              <Legend verticalAlign="top" height={32} {...chartLegendProps} />
              <Bar
                dataKey="actualSalesUf"
                name="Ventas Reales (UF)"
                fill={chartSeriesColors.actual}
                radius={chartBarRadius}
                barSize={20}
              />
              {hasBudget && (
                <Line
                  type="monotone"
                  dataKey="budgetedSalesUf"
                  name="Presupuesto (UF)"
                  stroke={chartSeriesColors.budget}
                  strokeWidth={2}
                  dot={{ r: 3, fill: chartSeriesColors.budget }}
                  strokeDasharray="5 3"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </MetricChartCard>

      {/* Table */}
      <DataTable
        table={table}
        emptyMessage="Sin datos de ventas para el periodo."
      />
    </div>
  );
}
