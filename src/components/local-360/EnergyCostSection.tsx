"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  buildPeriodoTickFormatter,
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
} from "@/lib/charts/theme";
import { formatPeriodoCorto, formatUf } from "@/lib/utils";
import type { EnergyMonthlyPoint } from "@/types/local-360";

type EnergyCostSectionProps = {
  data: EnergyMonthlyPoint[];
};

export function EnergyCostSection({ data }: EnergyCostSectionProps): JSX.Element {
  const hasData = data.some((p) => p.costoUf > 0);
  if (!hasData) {
    return (
      <ModuleSectionCard
        title="Costo Energía"
        description="Sin registros de energía para el rango seleccionado."
      >
        <div className="px-4 py-6 text-center text-sm text-slate-400">No hay datos.</div>
      </ModuleSectionCard>
    );
  }

  const totalUf = data.reduce((s, p) => s + p.costoUf, 0);
  const periodsWithData = data.filter((p) => p.costoUf > 0).length;
  const avgUf = periodsWithData > 0 ? totalUf / periodsWithData : 0;

  return (
    <ModuleSectionCard
      title="Costo Energía"
      description="Consumo facturado de energía mensual en UF."
    >
      <div className="px-5 py-4">
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat label="Total rango" value={`${formatUf(totalUf)} UF`} />
          <Stat label="Promedio mensual" value={`${formatUf(avgUf)} UF`} />
          <Stat label="Períodos con consumo" value={String(periodsWithData)} />
        </div>
        <ResponsiveContainer width="100%" height={chartHeight.md}>
          <LineChart data={data} margin={chartMargins.default}>
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="period"
              {...chartAxisProps}
              tickFormatter={buildPeriodoTickFormatter(data.length)}
            />
            <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v)} />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(label) => formatPeriodoCorto(String(label))}
                  valueFormatter={(value) => `${formatUf(Number(value))} UF`}
                />
              }
            />
            <Legend {...chartLegendProps} />
            <Line
              type="monotone"
              dataKey="costoUf"
              name="Costo energía"
              stroke={chartColors.gold}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ModuleSectionCard>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}
