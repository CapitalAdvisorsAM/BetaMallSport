"use client";

import { useCallback, useEffect, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import {
  chartAxisProps,
  chartBarRadius,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  chartGradientGroup,
  gradientId,
  chartSeriesColors,
  buildPeriodoTickFormatter,
  getSeriesColor,
} from "@/lib/charts/theme";
import { cn, formatPeriodoCorto, formatUf } from "@/lib/utils";
import type { CashFlowResponse } from "@/types/finance";

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

const compactTheme = getTableTheme("compact");

function formatAmount(value: number): string {
  if (value === 0) return "—";
  return formatUf(value, 0);
}

export function CashFlowClient({ selectedProjectId, defaultDesde, defaultHasta }: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<CashFlowResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/cash-flow?${params}`);
      setData(res.ok ? ((await res.json()) as CashFlowResponse) : null);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const chartData = (data?.periods ?? []).map((period) => ({
    period,
    net: data?.netByPeriod[period] ?? 0,
    cumulative: data?.cumulativeByPeriod[period] ?? 0,
  }));

  const cumulativeGradient = gradientId("cash-flow-cumulative");

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Flujo Caja (CLP)"
        description="Seguimiento de movimientos bancarios consolidados desde la hoja Data Bco."
        actions={
          <ProjectPeriodToolbar desde={desde} hasta={hasta} onDesdeChange={setDesde} onHastaChange={setHasta} />
        }
      />

      {loading ? (
        <ModuleLoadingState message="Cargando flujo caja..." />
      ) : !data || data.sections.length === 0 ? (
        <ModuleEmptyState
          message="Sin movimientos bancarios para el rango seleccionado."
          actionHref="/imports"
          actionLabel="Cargar banco"
        />
      ) : (
        <>
          <MetricChartCard
            title="Evolución de movimientos bancarios"
            metricId="chart_finance_cash_flow"
            description="Área acumulada y total mensual consolidado en CLP."
          >
            <ResponsiveContainer width="100%" height={chartHeight.md}>
              <ComposedChart data={chartData} margin={chartMargins.default}>
                <defs>
                  {chartGradientGroup([{ id: cumulativeGradient, color: chartSeriesColors.actual }])}
                </defs>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="period" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(data?.periods.length ?? 0)} />
                <YAxis {...chartAxisProps} tickFormatter={(value: number) => formatUf(value, 0)} />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => formatPeriodoCorto(String(l))}
                      valueFormatter={(value) =>
                        typeof value === "number" ? formatUf(value, 0) : String(value ?? "—")
                      }
                    />
                  }
                />
                <Legend {...chartLegendProps} />
                <Area type="monotone" dataKey="cumulative" name="Acumulado" fill={`url(#${cumulativeGradient})`} stroke={chartSeriesColors.actual} />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* chart22 — Diversificación de Caja por Banco */}
          {data.bankNames.length > 0 && (
            <MetricChartCard
              title="Diversificación de Caja por Banco (CLP)"
              metricId="chart_cash_bank_diversification"
              description="Saldo acumulado por banco en cada período. Barras apiladas por institución financiera."
            >
              <ResponsiveContainer width="100%" height={chartHeight.md}>
                <ComposedChart data={data.periods.map((p) => {
                  const entry: Record<string, string | number> = { period: p };
                  for (const s of data.bankBreakdown) entry[s.bank] = s.byPeriod[p] ?? 0;
                  return entry;
                })} margin={chartMargins.default}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="period" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(data.periods.length)} />
                  <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => formatPeriodoCorto(String(l))}
                        valueFormatter={(value) => typeof value === "number" ? formatUf(value, 0) : String(value ?? "—")}
                      />
                    }
                  />
                  <Legend {...chartLegendProps} />
                  {data.bankNames.map((bank, i) => (
                    <Bar key={bank} dataKey={bank} name={bank} stackId="banks" fill={getSeriesColor(i)} radius={i === data.bankNames.length - 1 ? chartBarRadius : [0, 0, 0, 0]} maxBarSize={20} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </MetricChartCard>
          )}

          {/* chart23 — Fondos Mutuos */}
          {Object.keys(data.fondosMutuosByPeriod).length > 0 && (
            <MetricChartCard
              title="Fondos Mutuos (CLP)"
              metricId="chart_cash_fondos_mutuos"
              description="Evolución del saldo de fondos mutuos del activo corriente por período."
            >
              <ResponsiveContainer width="100%" height={chartHeight.sm}>
                <ComposedChart data={data.periods.map((p) => ({ period: p, "Fondos Mutuos": data.fondosMutuosByPeriod[p] ?? 0 }))} margin={chartMargins.default}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="period" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(data.periods.length)} />
                  <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => formatPeriodoCorto(String(l))}
                        valueFormatter={(value) => typeof value === "number" ? formatUf(value, 0) : String(value ?? "—")}
                      />
                    }
                  />
                  <Legend {...chartLegendProps} />
                  <Line type="monotone" dataKey="Fondos Mutuos" name="Fondos Mutuos" stroke={chartSeriesColors.actual} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </MetricChartCard>
          )}

          {/* chart25 — Banco + Fondos Mutuos combinado */}
          {data.bankNames.length > 0 && Object.keys(data.fondosMutuosByPeriod).length > 0 && (
            <MetricChartCard
              title="Caja por Banco + Fondos Mutuos (CLP)"
              metricId="chart_cash_diversification_combined"
              description="Barras apiladas por banco y línea de fondos mutuos en un mismo gráfico."
            >
              <ResponsiveContainer width="100%" height={chartHeight.md}>
                <ComposedChart data={data.periods.map((p) => {
                  const entry: Record<string, string | number> = { period: p, "Fondos Mutuos": data.fondosMutuosByPeriod[p] ?? 0 };
                  for (const s of data.bankBreakdown) entry[s.bank] = s.byPeriod[p] ?? 0;
                  return entry;
                })} margin={chartMargins.default}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="period" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(data.periods.length)} />
                  <YAxis yAxisId="left" {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                  <YAxis yAxisId="right" orientation="right" {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => formatPeriodoCorto(String(l))}
                        valueFormatter={(value) => typeof value === "number" ? formatUf(value, 0) : String(value ?? "—")}
                      />
                    }
                  />
                  <Legend {...chartLegendProps} />
                  {data.bankNames.map((bank, i) => (
                    <Bar yAxisId="left" key={bank} dataKey={bank} name={bank} stackId="banks" fill={getSeriesColor(i)} radius={i === data.bankNames.length - 1 ? chartBarRadius : [0, 0, 0, 0]} maxBarSize={20} />
                  ))}
                  <Line yAxisId="right" type="monotone" dataKey="Fondos Mutuos" name="Fondos Mutuos" stroke="#011E42" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </ComposedChart>
              </ResponsiveContainer>
            </MetricChartCard>
          )}

          <ModuleSectionCard>
            <UnifiedTable
              density="compact"
              toolbar={<p className="text-xs text-slate-400">{data.sections.length} clasificaciones</p>}
            >
              <table className={cn(compactTheme.table, "text-xs")}>
                <thead className={compactTheme.head}>
                  <tr>
                    <th className={compactTheme.headCell}>Clasificación</th>
                    {data.periods.map((period) => (
                      <th key={period} className={cn(compactTheme.compactHeadCell, "min-w-[84px] text-right")}>
                        {formatPeriodoCorto(period)}
                      </th>
                    ))}
                    <th className={cn(compactTheme.compactHeadCell, "text-right")}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.sections.map((section, index) => (
                    <tr key={section.classification} className={cn(getStripedRowClass(index, "compact"), compactTheme.rowHover)}>
                      <td className="py-1.5 pl-4 pr-3 font-medium text-slate-700">{section.classification}</td>
                      {data.periods.map((period) => (
                        <td key={period} className="px-2 py-1.5 text-right text-slate-600">
                          {formatAmount(section.byPeriod[period] ?? 0)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-800">{formatAmount(section.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-brand-600 bg-brand-700 text-white hover:bg-brand-700">
                    <td className="py-2 pl-4 pr-3 text-xs font-bold uppercase tracking-wide">Total mensual</td>
                    {data.periods.map((period) => (
                      <td key={period} className="px-2 py-2 text-right text-xs font-bold">
                        {formatAmount(data.netByPeriod[period] ?? 0)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right text-xs font-bold">
                      {formatAmount(Object.values(data.netByPeriod).reduce((sum, value) => sum + value, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </UnifiedTable>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}
