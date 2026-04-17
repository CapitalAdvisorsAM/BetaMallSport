"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartMargins,
} from "@/lib/charts/theme";
import { formatDecimal } from "@/lib/utils";

type ExpirationRow = {
  anio: number;
  cantidadContratos: number;
  m2: number;
  pctTotal: number;
};

type ExpirationProfileChartProps = {
  data: ExpirationRow[];
};

// Brand-gradient palette so adjacent years read as "same family, progressing".
const BAR_COLORS = [
  chartColors.brandDark,
  chartColors.brandPrimary,
  "#3b82f6",
  "#60a5fa",
  chartColors.brandLight,
  chartColors.brandSurface
];

export function ExpirationProfileChart({ data }: ExpirationProfileChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Sin datos de vencimientos.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <ResponsiveContainer width="100%" height={chartHeight.md}>
        <BarChart data={data} margin={chartMargins.default}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="anio" {...chartAxisProps} />
          <YAxis
            yAxisId="m2"
            {...chartAxisProps}
            tickFormatter={(v: number) => formatDecimal(v)}
            label={{ value: "m²", angle: -90, position: "insideLeft", fontSize: 11, fill: chartColors.axis }}
          />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(label) => `Año ${label}`}
                valueFormatter={(value) => `${formatDecimal(Number(value))} m²`}
              />
            }
          />
          <Bar yAxisId="m2" dataKey="m2" name="GLA" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <th className="px-3 py-2">Año</th>
              <th className="px-3 py-2 text-right">Contratos</th>
              <th className="px-3 py-2 text-right">GLA (m²)</th>
              <th className="px-3 py-2 text-right">% del Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.anio} className="border-b border-slate-100 hover:bg-brand-50">
                <td className="px-3 py-2 font-medium">{row.anio}</td>
                <td className="px-3 py-2 text-right">{row.cantidadContratos}</td>
                <td className="px-3 py-2 text-right">{formatDecimal(row.m2)}</td>
                <td className="px-3 py-2 text-right">{formatDecimal(row.pctTotal)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
