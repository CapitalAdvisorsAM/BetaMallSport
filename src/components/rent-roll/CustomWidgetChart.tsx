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
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartBarRadius,
  chartColors,
  chartGridProps,
  chartHeight,
  chartMargins,
} from "@/lib/charts/theme";
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

  const yTick = (value: number) => yAxisFormatter(value, format);

  const commonProps = {
    data,
    margin: { ...chartMargins.default, left: 0 },
  };

  const commonAxes = (
    <>
      <CartesianGrid {...chartGridProps} />
      <XAxis
        dataKey="periodo"
        tickFormatter={xAxisTickFormatter}
        {...chartAxisProps}
      />
      <YAxis
        tickFormatter={yTick}
        {...chartAxisProps}
        width={52}
      />
      <Tooltip
        content={
          <ChartTooltip
            labelFormatter={(l) => {
              const formatted = tooltipLabelFormatter(l as ReactNode);
              return typeof formatted === "string" ? formatted : String(l);
            }}
            valueFormatter={(value) =>
              typeof value === "number" ? formatValue(value, format) : "—"
            }
          />
        }
      />
      <ReferenceLine
        x={currentPeriodo}
        stroke={chartColors.warningLight}
        strokeDasharray="4 2"
        label={{ value: "Hoy", position: "top", fontSize: 10, fill: chartColors.warningLight }}
      />
    </>
  );

  return (
    <MetricChartCard title={widget.title} metricId="chart_rent_roll_custom_widget">
      <ResponsiveContainer width="100%" height={chartHeight.sm}>
        {widget.chartType === "bar" ? (
          <BarChart {...commonProps}>
            {commonAxes}
            <Bar dataKey="value" name={widget.title} fill={chartColors.brandPrimary} radius={chartBarRadius} />
          </BarChart>
        ) : widget.chartType === "area" ? (
          <AreaChart {...commonProps}>
            {commonAxes}
            <Area
              type="monotone"
              dataKey="value"
              name={widget.title}
              stroke={chartColors.brandPrimary}
              strokeWidth={2}
              fill={chartColors.brandSurface}
              dot={false}
            />
          </AreaChart>
        ) : (
          <LineChart {...commonProps}>
            {commonAxes}
            <Line
              type="monotone"
              dataKey="value"
              name={widget.title}
              stroke={chartColors.brandPrimary}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </MetricChartCard>
  );
}
