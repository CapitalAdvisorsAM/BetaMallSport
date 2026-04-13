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

const BAR_COLORS = [
  "#1e40af", // brand-800
  "#2563eb", // brand-600
  "#3b82f6", // brand-500
  "#60a5fa", // brand-400
  "#93c5fd", // brand-300
  "#bfdbfe"  // brand-200
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
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="anio" tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="m2"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => formatDecimal(v)}
            label={{ value: "m²", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <Tooltip
            formatter={(value) => [`${formatDecimal(Number(value))} m²`, "GLA"]}
            labelFormatter={(label) => `Año ${label}`}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar yAxisId="m2" dataKey="m2" name="m2" radius={[4, 4, 0, 0]}>
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
