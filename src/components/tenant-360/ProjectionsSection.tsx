"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { Badge } from "@/components/ui/badge";
import { tableTheme, getStripedRowClass } from "@/components/ui/table-theme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
} from "@/lib/charts/theme";
import { cn, formatPercent, formatUf } from "@/lib/utils";
import type { Tenant360Projection, GapAnalysisRow } from "@/types/tenant-360";

type ProjectionsSectionProps = {
  projections: Tenant360Projection;
  gapAnalysis: GapAnalysisRow[];
};

const RISK_BADGE: Record<string, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700"
};

const RISK_LABEL: Record<string, string> = {
  high: "Alto",
  medium: "Medio",
  low: "Bajo"
};

export function ProjectionsSection({ projections, gapAnalysis }: ProjectionsSectionProps): JSX.Element {
  const hasExpiring = projections.expiringContracts.length > 0;
  const hasGap = gapAnalysis.some((r) => r.expectedBillingUf > 0 || r.actualBillingUf > 0);
  const hasProRata = gapAnalysis.some((r) => r.expectedProRataUf !== null);
  const [useProRata, setUseProRata] = useState(false);

  if (!hasExpiring && !hasGap) {
    return (
      <ModuleSectionCard title="Proyecciones">
        <p className="px-4 py-6 text-center text-sm text-slate-400">Sin contratos proximos a vencer ni datos para analisis de brecha.</p>
      </ModuleSectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Expiry Risk */}
      {hasExpiring ? (
        <ModuleSectionCard title="Contratos por Vencer" description="Renta en riesgo por vencimiento de contratos.">
          <div className="px-4 py-3">
            <div className="mb-4">
              <KpiCard
                metricId="kpi_tenant360_renta_riesgo_uf"
                title="Renta en Riesgo"
                value={`${formatUf(projections.totalRentAtRiskUf)} UF`}
                subtitle={`${projections.expiringContracts.length} contrato(s) vencen en los proximos 180 dias`}
                accent={projections.totalRentAtRiskUf > 0 ? "red" : "green"}
              />
            </div>
            <table className={tableTheme.table}>
              <thead className={tableTheme.head}>
                <tr>
                  <th className={tableTheme.compactHeadCell}>Local</th>
                  <th className={tableTheme.compactHeadCell}>Termino</th>
                  <th className={`${tableTheme.compactHeadCell} text-right`}>Dias Rest.</th>
                  <th className={`${tableTheme.compactHeadCell} text-right`}>Renta UF</th>
                  <th className={tableTheme.compactHeadCell}>Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projections.expiringContracts.map((c, i) => (
                  <tr key={c.id} className={getStripedRowClass(i)}>
                    <td className="px-3 py-1.5 text-xs font-medium text-slate-700">{c.localCodigo}</td>
                    <td className="px-3 py-1.5 text-xs tabular-nums text-slate-600">{c.fechaTermino}</td>
                    <td className={cn(
                      "px-3 py-1.5 text-right text-xs font-semibold tabular-nums",
                      c.riskLevel === "high" ? "text-rose-600" : c.riskLevel === "medium" ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {c.diasRestantes}
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-700">{formatUf(c.rentaFijaUf)}</td>
                    <td className="px-3 py-1.5">
                      <Badge
                        variant="outline"
                        className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", RISK_BADGE[c.riskLevel])}
                      >
                        {RISK_LABEL[c.riskLevel]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModuleSectionCard>
      ) : null}

      {/* Gap Analysis */}
      {hasGap ? (
        <ModuleSectionCard
          title="Analisis de Brecha"
          description="Facturacion esperada (segun contrato) vs facturacion real (segun registros contables)."
        >
          <div className="px-4 py-3">
            {/* Pro-rata toggle */}
            {hasProRata && (
              <label className="mb-3 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={useProRata}
                  onChange={(e) => setUseProRata(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Usar pro-rata (ajustar esperado por dias de ocupacion)
              </label>
            )}

            {/* Chart */}
            <ResponsiveContainer width="100%" height={chartHeight.md}>
              <ComposedChart
                data={gapAnalysis.map((r) => ({
                  ...r,
                  chartExpected: useProRata && r.expectedProRataUf !== null ? r.expectedProRataUf : r.expectedBillingUf,
                  chartGapPct: useProRata && r.gapProRataPct !== null ? r.gapProRataPct : r.gapPct
                }))}
                margin={chartMargins.default}
              >
                <CartesianGrid {...chartGridProps} />
                <XAxis
                  dataKey="period"
                  {...chartAxisProps}
                />
                <YAxis
                  yAxisId="left"
                  {...chartAxisProps}
                  tickFormatter={(v: number) => formatUf(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...chartAxisProps}
                  tickFormatter={(v: number) => formatPercent(v, 0)}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(value, name) => {
                        const v = typeof value === "number" ? value : Number(value ?? 0);
                        if (String(name) === "Brecha %") return formatPercent(v);
                        return `${formatUf(v)} UF`;
                      }}
                    />
                  }
                />
                <Legend verticalAlign="top" height={32} {...chartLegendProps} />
                <Bar
                  yAxisId="left"
                  dataKey="chartExpected"
                  name={useProRata ? "Esperado Pro-rata (UF)" : "Esperado (UF)"}
                  fill={chartColors.brandLight}
                  radius={[3, 3, 0, 0]}
                  barSize={18}
                />
                <Bar
                  yAxisId="left"
                  dataKey="actualBillingUf"
                  name="Real (UF)"
                  fill={chartColors.brandPrimary}
                  radius={[3, 3, 0, 0]}
                  barSize={18}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="chartGapPct"
                  name="Brecha %"
                  stroke={chartColors.negative}
                  strokeWidth={2}
                  dot={{ r: 3, fill: chartColors.negative }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Detail table */}
            <div className="mt-4 overflow-x-auto">
              <table className={tableTheme.table}>
                <thead className={tableTheme.head}>
                  <tr>
                    <th className={tableTheme.compactHeadCell}>Periodo</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>Esperado (UF)</th>
                    {useProRata && (
                      <>
                        <th className={`${tableTheme.compactHeadCell} text-center`}>Dias Ocup.</th>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>Esp. Pro-rata (UF)</th>
                      </>
                    )}
                    <th className={`${tableTheme.compactHeadCell} text-right`}>Real (UF)</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>Brecha (UF)</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>Brecha %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gapAnalysis.map((row, i) => {
                    const hasData = row.expectedBillingUf > 0 || row.actualBillingUf > 0;
                    if (!hasData) return null;

                    const displayGapUf = useProRata && row.gapProRataUf !== null ? row.gapProRataUf : row.gapUf;
                    const displayGapPct = useProRata && row.gapProRataPct !== null ? row.gapProRataPct : row.gapPct;
                    const isPositiveGap = displayGapUf > 0.01;
                    const isNegativeGap = displayGapUf < -0.01;

                    return (
                      <tr key={row.period} className={getStripedRowClass(i)}>
                        <td className="px-3 py-1.5 text-xs tabular-nums text-slate-600">{row.period}</td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-700">
                          {formatUf(row.expectedBillingUf)}
                        </td>
                        {useProRata && (
                          <>
                            <td className="px-3 py-1.5 text-center text-xs tabular-nums text-slate-500">
                              {row.occupiedDays !== null && row.totalDays !== null
                                ? `${row.occupiedDays}/${row.totalDays}`
                                : "–"}
                            </td>
                            <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-700">
                              {row.expectedProRataUf !== null ? formatUf(row.expectedProRataUf) : "–"}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-slate-700">
                          {formatUf(row.actualBillingUf)}
                        </td>
                        <td className={cn(
                          "px-3 py-1.5 text-right text-xs font-semibold tabular-nums",
                          isPositiveGap ? "text-rose-600" : isNegativeGap ? "text-emerald-600" : "text-slate-500"
                        )}>
                          {isPositiveGap ? "+" : ""}{formatUf(displayGapUf)}
                        </td>
                        <td className={cn(
                          "px-3 py-1.5 text-right text-xs font-semibold tabular-nums",
                          isPositiveGap ? "text-rose-600" : isNegativeGap ? "text-emerald-600" : "text-slate-500"
                        )}>
                          {isPositiveGap ? "+" : ""}{formatPercent(displayGapPct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </ModuleSectionCard>
      ) : null}
    </div>
  );
}
