"use client";

import { useCallback, useEffect, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  chartGradientGroup,
  gradientId,
  chartSeriesColors,
} from "@/lib/charts/theme";
import { cn, formatUf } from "@/lib/utils";
import type { CashFlowResponse } from "@/types/finance";

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

const compactTheme = getTableTheme("compact");

function formatPeriodo(period: string): string {
  const [year, month] = period.split("-");
  return month && year ? `${month}/${year.slice(2)}` : period;
}

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
      const res = await fetch(`/api/finance/cash-flow?${params}`);
      setData(res.ok ? ((await res.json()) as CashFlowResponse) : null);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const chartData = (data?.periods ?? []).map((period) => ({
    period: formatPeriodo(period),
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
          actionHref="/finance/upload"
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
                <XAxis dataKey="period" {...chartAxisProps} />
                <YAxis {...chartAxisProps} tickFormatter={(value: number) => formatUf(value, 0)} />
                <Tooltip
                  content={
                    <ChartTooltip
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
                        {formatPeriodo(period)}
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
