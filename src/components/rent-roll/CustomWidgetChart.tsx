"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  evaluateFormula,
  type FormulaConfig,
  type DisplayFormat,
} from "@/lib/dashboard/custom-widget-engine";
import type { PeriodoMetrica } from "@/types/timeline";
import type { ReactNode } from "react";

type CustomWidgetRow = {
  id: string;
  title: string;
  chartType: string;
  enabled: boolean;
  position: number;
  formulaConfig: FormulaConfig;
};

type Props = {
  widget: CustomWidgetRow;
  periodos: PeriodoMetrica[];
  currentPeriodo: string;
  xAxisTickFormatter: (value: string, index: number) => string;
  tooltipLabelFormatter: (label: ReactNode) => ReactNode;
};

function formatValue(value: number, format: DisplayFormat): string {
  switch (format) {
    case "percent":
      return `${value.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    case "uf":
      return `${value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`;
    case "m2":
      return `${value.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} m²`;
    case "months":
      return value >= 12 ? `${(value / 12).toFixed(1)}a` : `${value.toFixed(1)}m`;
    default:
      return value.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  }
}

function getFormat(config: FormulaConfig): DisplayFormat {
  return config.format;
}

function yAxisFormatter(value: number, format: DisplayFormat): string {
  switch (format) {
    case "percent":  return `${value.toFixed(0)}%`;
    case "m2":       return value.toLocaleString("es-CL", { maximumFractionDigits: 0 });
    case "months":   return value >= 12 ? `${Math.round(value / 12)}a` : `${Math.round(value)}m`;
    default:         return value.toLocaleString("es-CL", { maximumFractionDigits: 0 });
  }
}

export function CustomWidgetChart({
  widget,
  periodos,
  currentPeriodo,
  xAxisTickFormatter,
  tooltipLabelFormatter,
}: Props) {
  const chartData = evaluateFormula(periodos, widget.formulaConfig);
  const format = getFormat(widget.formulaConfig);

  const data = chartData.map((p) => ({
    periodo: p.periodo,
    value: p.value,
  }));

  const tooltipFormatter = (value: unknown) => [
    typeof value === "number" ? formatValue(value, format) : "—",
    widget.title,
  ];

  const yTick = (value: number) => yAxisFormatter(value, format);

  const commonProps = {
    data,
    margin: { top: 5, right: 16, left: 0, bottom: 5 } as const,
  };

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
      <XAxis
        dataKey="periodo"
        tickFormatter={xAxisTickFormatter}
        tick={{ fontSize: 11, fill: "#64748b" }}
        tickLine={false}
      />
      <YAxis
        tickFormatter={yTick}
        tick={{ fontSize: 11, fill: "#64748b" }}
        tickLine={false}
        axisLine={false}
        width={52}
      />
      <Tooltip
        labelFormatter={tooltipLabelFormatter}
        formatter={tooltipFormatter}
      />
      <ReferenceLine
        x={currentPeriodo}
        stroke="#f59e0b"
        strokeDasharray="4 2"
        label={{ value: "Hoy", position: "top", fontSize: 10, fill: "#f59e0b" }}
      />
    </>
  );

  return (
    <article className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-brand-700">{widget.title}</h3>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          {widget.chartType === "bar" ? (
            <BarChart {...commonProps}>
              {commonAxes}
              <Bar dataKey="value" fill="#1e40af" radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : widget.chartType === "area" ? (
            <AreaChart {...commonProps}>
              {commonAxes}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1e40af"
                strokeWidth={2}
                fill="#dbeafe"
                dot={false}
              />
            </AreaChart>
          ) : (
            <LineChart {...commonProps}>
              {commonAxes}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1e40af"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </article>
  );
}
