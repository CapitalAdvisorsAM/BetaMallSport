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

export type RentRollCategoryConcentrationDatum = {
  categoria: string;
  glam2: number;
  pct: number;
  contratos: number;
};

type RentRollCategoryConcentrationProps = {
  data: RentRollCategoryConcentrationDatum[];
};

const CATEGORY_COLORS = [
  "#011E42",
  "#164786",
  "#d4a84b",
  "#93C5FD",
  "#BFDBFE",
  "#f0d080"
];

export function RentRollCategoryConcentration({
  data
}: RentRollCategoryConcentrationProps): JSX.Element {
  return (
    <article className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-brand-700">
          Concentracion de GLA arrendado por categoria
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Snapshot de contratos activos agrupados por `Local.zona`.
        </p>
      </div>

      {data.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          No hay contratos activos con GLA arrendado para la fecha seleccionada.
        </div>
      ) : (
        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 24, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${formatDecimal(value)}%`}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="categoria"
                  type="category"
                  width={100}
                  tick={{ fontSize: 11, fill: "#334155" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#eff6ff" }}
                  formatter={(value, name, item) => {
                    const payload = item.payload as RentRollCategoryConcentrationDatum;
                    if (name === "pct") {
                      return [`${formatDecimal(Number(value))}%`, "% GLA arrendado"];
                    }
                    return [`${payload.contratos}`, "Contratos activos"];
                  }}
                  labelFormatter={(label, items) => {
                    const payload = items[0]?.payload as RentRollCategoryConcentrationDatum | undefined;
                    if (!payload) {
                      return label;
                    }
                    return `${payload.categoria} · ${formatDecimal(payload.glam2)} m2`;
                  }}
                />
                <Bar dataKey="pct" radius={[0, 6, 6, 0]} name="pct">
                  {data.map((entry, index) => (
                    <Cell
                      key={`${entry.categoria}-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-3">
            {data.map((item, index) => (
              <div key={item.categoria} className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                    />
                    <span className="text-sm font-semibold text-slate-900">{item.categoria}</span>
                  </div>
                  <span className="text-sm font-semibold text-brand-700">
                    {formatDecimal(item.pct)}%
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{formatDecimal(item.glam2)} m2</span>
                  <span>{item.contratos} contratos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
