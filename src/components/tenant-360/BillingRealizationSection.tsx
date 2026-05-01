"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartMargins,
  buildPeriodoTickFormatter,
} from "@/lib/charts/theme";
import { formatPercent, formatPeriodoCorto, formatUf } from "@/lib/utils";
import type { GapAnalysisRow } from "@/types/tenant-360";

type BillingRealizationSectionProps = {
  gapAnalysis: GapAnalysisRow[];
};

function computeMetrics(rows: GapAnalysisRow[]) {
  const activeRows = rows.filter((r) => r.expectedBillingUf > 0);
  if (activeRows.length === 0) return null;

  const realizationValues = activeRows.map((r) =>
    r.expectedBillingUf > 0 ? (r.actualBillingUf / r.expectedBillingUf) * 100 : null
  ).filter((v): v is number => v !== null);

  const avgRealization = realizationValues.length > 0
    ? realizationValues.reduce((a, b) => a + b, 0) / realizationValues.length
    : null;

  const cumulativeGap = activeRows.reduce((s, r) => s + r.gapUf, 0);
  const periodsWithGap = activeRows.filter((r) => r.gapUf > 0.5).length;

  const chartData = activeRows.map((r) => ({
    period: r.period,
    realizationPct: r.expectedBillingUf > 0
      ? (r.actualBillingUf / r.expectedBillingUf) * 100
      : null,
  }));

  return { avgRealization, cumulativeGap, periodsWithGap, chartData, total: activeRows.length };
}

function realizationAccent(pct: number | null): "green" | "yellow" | "red" | "slate" {
  if (pct === null) return "slate";
  if (pct >= 95) return "green";
  if (pct >= 85) return "yellow";
  return "red";
}

export function BillingRealizationSection({ gapAnalysis }: BillingRealizationSectionProps): JSX.Element {
  const metrics = computeMetrics(gapAnalysis);

  if (!metrics) {
    return (
      <ModuleSectionCard title="Tasa de Realizacion">
        <p className="px-5 py-6 text-center text-sm text-slate-400">Sin datos de brecha para calcular la tasa de realizacion.</p>
      </ModuleSectionCard>
    );
  }

  const { avgRealization, cumulativeGap, periodsWithGap, chartData, total } = metrics;
  const isOverBilled = cumulativeGap < -0.5;

  return (
    <ModuleSectionCard
      title="Tasa de Realizacion de Facturacion"
      description="Facturacion real como porcentaje de la facturacion esperada segun contrato."
    >
      <div className="space-y-4 px-4 py-4">
        {/* KPI row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            title="Realizacion Promedio"
            value={avgRealization !== null ? formatPercent(avgRealization) : "—"}
            accent={realizationAccent(avgRealization)}
            subtitle="Facturado / Esperado"
          />
          <KpiCard
            title="Brecha Acumulada"
            value={`${cumulativeGap >= 0 ? "+" : ""}${formatUf(cumulativeGap)} UF`}
            accent={cumulativeGap > 0.5 ? "red" : isOverBilled ? "green" : "slate"}
            subtitle={cumulativeGap > 0.5 ? "Facturacion por debajo del contrato" : isOverBilled ? "Facturacion sobre contrato" : "Sin brecha significativa"}
          />
          <KpiCard
            title="Periodos con Brecha"
            value={`${periodsWithGap} / ${total}`}
            accent={periodsWithGap > total / 2 ? "red" : periodsWithGap > 0 ? "yellow" : "green"}
            subtitle="Meses donde facturado < esperado"
          />
        </div>

        {/* Area chart with color bands */}
        <ResponsiveContainer width="100%" height={chartHeight.sm}>
          <AreaChart data={chartData} margin={chartMargins.default}>
            {/* Color bands */}
            <ReferenceArea
              y1={95}
              y2={200}
              fill={chartColors.positive}
              fillOpacity={0.06}
            />
            <ReferenceArea
              y1={85}
              y2={95}
              fill={chartColors.warning}
              fillOpacity={0.08}
            />
            <ReferenceArea
              y1={0}
              y2={85}
              fill={chartColors.negative}
              fillOpacity={0.05}
            />
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="period"
              {...chartAxisProps}
              tickFormatter={buildPeriodoTickFormatter(chartData.length)}
            />
            <YAxis
              {...chartAxisProps}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              domain={[0, 120]}
            />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(l) => formatPeriodoCorto(String(l))}
                  valueFormatter={(value) => {
                    const v = typeof value === "number" ? value : Number(value ?? 0);
                    return formatPercent(v, 1);
                  }}
                />
              }
            />
            <ReferenceLine
              y={100}
              stroke={chartColors.axis}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="realizationPct"
              name="Realizacion %"
              stroke={chartColors.brandPrimary}
              fill={chartColors.brandSurface}
              fillOpacity={0.4}
              strokeWidth={2}
              dot={{ r: 3, fill: chartColors.brandPrimary }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>

        <p className="text-[11px] text-slate-400">
          Banda verde = realizacion ≥95% · Banda amarilla = 85–95% · Banda roja = &lt;85%
        </p>
      </div>
    </ModuleSectionCard>
  );
}
