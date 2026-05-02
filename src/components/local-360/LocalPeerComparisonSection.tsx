"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartMargins,
} from "@/lib/charts/theme";
import { formatUf } from "@/lib/utils";
import type { LocalPeerComparison } from "@/types/local-360";

type LocalPeerComparisonSectionProps = {
  data: LocalPeerComparison;
};

export function LocalPeerComparisonSection({ data }: LocalPeerComparisonSectionProps): JSX.Element {
  if (data.peerCount === 0) {
    return (
      <ModuleSectionCard
        title="Comparación con pares"
        description="Sin pares en la misma zona o tipo para comparar."
      >
        <div className="px-4 py-6 text-center text-sm text-slate-400">No hay locales pares.</div>
      </ModuleSectionCard>
    );
  }

  const diffVsAvg = data.thisLocal.billingUfPerM2 - data.peerAvgBillingUfPerM2;
  const diffPct =
    data.peerAvgBillingUfPerM2 > 0
      ? (diffVsAvg / data.peerAvgBillingUfPerM2) * 100
      : 0;

  // Build chart data: peers + this local, sorted desc, top 12 + this local always present
  const allRows = [...data.peers, {
    unitId: "__this__",
    codigo: "Este local",
    glam2: 0,
    totalBillingUf: data.thisLocal.totalBillingUf,
    billingUfPerM2: data.thisLocal.billingUfPerM2,
    isCurrent: true,
  }].sort((a, b) => b.billingUfPerM2 - a.billingUfPerM2);

  const limit = 15;
  const chartRows = allRows.slice(0, limit);
  if (!chartRows.some((r) => r.isCurrent)) {
    chartRows.push(allRows.find((r) => r.isCurrent)!);
  }

  return (
    <ModuleSectionCard
      title="Comparación con pares"
      description={`Comparado con ${data.peerCount} locales de la misma zona o tipo.`}
    >
      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            title="Este local"
            value={`${formatUf(data.thisLocal.billingUfPerM2)} UF/m²`}
            subtitle="Facturación promedio"
            accent="slate"
          />
          <KpiCard
            title="Promedio pares"
            value={`${formatUf(data.peerAvgBillingUfPerM2)} UF/m²`}
            subtitle="Pares activos en rango"
            accent="slate"
          />
          <KpiCard
            title="Mediana pares"
            value={`${formatUf(data.peerMedianBillingUfPerM2)} UF/m²`}
            subtitle="Resistente a outliers"
            accent="slate"
          />
          <KpiCard
            title="Ranking"
            value={`${data.rankBilling.position} / ${data.rankBilling.total}`}
            subtitle={`vs Promedio: ${diffVsAvg >= 0 ? "+" : ""}${formatUf(diffVsAvg)} UF/m² (${diffPct.toFixed(1)}%)`}
            accent={diffVsAvg >= 0 ? "green" : "red"}
          />
        </div>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Distribución (UF/m² facturados en el rango)
          </p>
          <ResponsiveContainer width="100%" height={chartHeight.md}>
            <BarChart data={chartRows} margin={chartMargins.default}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="codigo" {...chartAxisProps} interval={0} angle={-30} textAnchor="end" height={70} />
              <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v)} />
              <Tooltip
                content={
                  <ChartTooltip
                    valueFormatter={(value) => `${formatUf(Number(value))} UF/m²`}
                  />
                }
              />
              <Bar dataKey="billingUfPerM2" name="Facturación UF/m²">
                {chartRows.map((r) => (
                  <Cell
                    key={r.unitId}
                    fill={r.isCurrent ? chartColors.gold : chartColors.brandPrimary}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ModuleSectionCard>
  );
}
