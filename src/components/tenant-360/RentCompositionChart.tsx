"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { chartColors } from "@/lib/charts/theme";
import { formatUf, formatPercent } from "@/lib/utils";
import type { Tenant360Contract } from "@/types/tenant-360";

type RentCompositionChartProps = {
  contracts: Tenant360Contract[];
};

type Slice = {
  name: string;
  value: number;
  color: string;
};

function buildSlices(contracts: Tenant360Contract[]): Slice[] {
  let fixedUf = 0;
  let variableEstimatedUf = 0;
  let ggccUf = 0;

  for (const c of contracts) {
    if (c.estado !== "VIGENTE" && c.estado !== "GRACIA") continue;

    const glam2 = c.localGlam2 ?? 0;

    if (c.tarifaActual) {
      const t = c.tarifaActual;
      if (t.tipo === "FIJO_UF_M2") fixedUf += t.valor * glam2;
      else if (t.tipo === "FIJO_UF") fixedUf += t.valor;
      else if (t.tipo === "PORCENTAJE") variableEstimatedUf += 0;
    }

    if (c.ggccActual) {
      const g = c.ggccActual;
      const base = g.tarifaBaseUfM2 * glam2;
      const admin = base * (1 + (g.pctAdministracion ?? 0) / 100);
      ggccUf += admin;
    }
  }

  const hasVariable = contracts.some(
    (c) =>
      (c.estado === "VIGENTE" || c.estado === "GRACIA") &&
      c.tarifaActual?.tipo === "PORCENTAJE"
  );

  const slices: Slice[] = [];
  if (fixedUf > 0) slices.push({ name: "Renta Fija", value: fixedUf, color: chartColors.brandPrimary });
  if (hasVariable) slices.push({ name: "Renta Variable", value: variableEstimatedUf > 0 ? variableEstimatedUf : 0.01, color: chartColors.gold });
  if (ggccUf > 0) slices.push({ name: "GGCC", value: ggccUf, color: chartColors.positive });

  return slices;
}

export function RentCompositionChart({ contracts }: RentCompositionChartProps): JSX.Element {
  const slices = buildSlices(contracts);
  const total = slices.reduce((s, sl) => s + sl.value, 0);

  if (slices.length === 0 || total === 0) return <></>;

  return (
    <ModuleSectionCard
      title="Composicion de Renta"
      description="Distribucion mensual estimada de renta fija, variable y GGCC."
    >
      <div className="flex flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:items-start">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {slices.map((sl) => (
                <Cell key={sl.name} fill={sl.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown) => {
                const v = typeof value === "number" ? value : Number(value ?? 0);
                return [`${formatUf(v)} UF (${formatPercent((v / total) * 100)})`, ""];
              }}
              contentStyle={{
                fontSize: 11,
                borderRadius: 6,
                border: `1px solid ${chartColors.grid}`,
                background: "#fff",
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: chartColors.text }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Summary list */}
        <div className="w-full shrink-0 space-y-2 sm:w-40">
          {slices.map((sl) => (
            <div key={sl.name} className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ background: sl.color }}
                />
                <span className="text-xs text-slate-500">{sl.name}</span>
              </div>
              <p className="pl-3.5 text-sm font-semibold tabular-nums text-slate-700">
                {formatUf(sl.value)} UF
              </p>
              <p className="pl-3.5 text-[11px] text-slate-400">
                {formatPercent((sl.value / total) * 100)}
              </p>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-2">
            <p className="text-xs text-slate-400">Total mensual</p>
            <p className="text-sm font-bold tabular-nums text-brand-700">{formatUf(total)} UF</p>
          </div>
        </div>
      </div>
    </ModuleSectionCard>
  );
}
