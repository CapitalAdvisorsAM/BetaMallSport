"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  chartAxisProps,
  chartBarRadius,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
} from "@/lib/charts/theme";
import { formatDecimal, formatUf, cn } from "@/lib/utils";
import type { BudgetVsActualResponse } from "@/types/finance";

type BudgetVsActualClientProps = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatPeriodShort(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}

function achievementBadge(pct: number): { label: string; className: string } {
  if (pct >= 95) return { label: `${formatDecimal(pct)}%`, className: "bg-emerald-100 text-emerald-700" };
  if (pct >= 80) return { label: `${formatDecimal(pct)}%`, className: "bg-amber-100 text-amber-700" };
  return { label: `${formatDecimal(pct)}%`, className: "bg-rose-100 text-rose-700" };
}

function varianceColor(value: number): string {
  if (value > 0) return "text-rose-700 font-semibold";
  if (value < 0) return "text-emerald-700";
  return "text-slate-700";
}

export function BudgetVsActualClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta,
}: BudgetVsActualClientProps): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<BudgetVsActualResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const response = await fetch(`/api/finance/budget-vs-actual?${params.toString()}`);
      const payload = (await response.json()) as BudgetVsActualResponse;
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.monthly.map((m) => ({
      ...m,
      label: formatPeriodShort(m.period),
    }));
  }, [data]);

  const summary = data?.summary;

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Presupuesto vs Real"
        description="Ingreso esperado (contratos + ventas presupuestadas) vs facturacion real por arrendatario."
        valueBadges={["teorico", "efectivo"]}
        actions={
          <ProjectPeriodToolbar
            desde={desde}
            hasta={hasta}
            onDesdeChange={setDesde}
            onHastaChange={setHasta}
          />
        }
      />

      {loading ? (
        <ModuleLoadingState message="Cargando presupuesto vs real..." />
      ) : !data || data.rows.length === 0 ? (
        <ModuleSectionCard>
          <ModuleEmptyState
            message="Sin datos de presupuesto para el rango seleccionado."
            actionHref="/finance/upload"
            actionLabel="Cargar datos"
          />
        </ModuleSectionCard>
      ) : (
        <>
          {/* KPI Row */}
          {summary && (
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                metricId="kpi_bva_presupuesto_uf"
                title="Presupuesto (UF)"
                value={formatUf(summary.totalBudgetUf)}
                accent="slate"
              />
              <KpiCard
                metricId="kpi_bva_facturado_real_uf"
                title="Facturado Real (UF)"
                value={formatUf(summary.totalActualUf)}
                accent="slate"
              />
              <KpiCard
                metricId="kpi_bva_varianza_uf"
                title="Varianza (UF)"
                value={formatUf(summary.totalVarianceUf)}
                subtitle={`${formatUf(summary.totalVariancePct, 1)}% del presupuesto`}
                accent={summary.totalVarianceUf <= 0 ? "green" : "red"}
              />
              <KpiCard
                metricId="kpi_bva_cumplimiento_pct"
                title="Cumplimiento (%)"
                value={`${formatUf(summary.totalAchievementPct, 1)}%`}
                subtitle={`${summary.tenantsOverBudget} sobre / ${summary.tenantsUnderBudget} bajo presupuesto`}
                accent={summary.totalAchievementPct >= 95 ? "green" : summary.totalAchievementPct >= 80 ? "yellow" : "red"}
              />
            </section>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <MetricChartCard title="Presupuesto vs Real mensual" metricId="chart_bva_mensual">
              <ResponsiveContainer width="100%" height={chartHeight.lg}>
                <ComposedChart data={chartData} margin={chartMargins.default}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="label" {...chartAxisProps} />
                  <YAxis yAxisId="left" {...chartAxisProps} />
                  <YAxis yAxisId="right" orientation="right" {...chartAxisProps} domain={[0, "auto"]} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(value, name) => {
                          const v = Number(value);
                          if (String(name) === "Cumplimiento (%)") return `${formatUf(v, 1)}%`;
                          return formatUf(v);
                        }}
                      />
                    }
                  />
                  <Legend {...chartLegendProps} verticalAlign="top" />
                  <Bar yAxisId="left" dataKey="budgetUf" name="Presupuesto (UF)" fill={chartColors.brandLight} radius={chartBarRadius} />
                  <Bar yAxisId="left" dataKey="actualUf" name="Real (UF)" fill={chartColors.positiveLight} radius={chartBarRadius} />
                  <Line yAxisId="right" dataKey="achievementPct" name="Cumplimiento (%)" stroke={chartColors.warning} strokeWidth={2} dot={{ r: 3, fill: chartColors.warning }} />
                </ComposedChart>
              </ResponsiveContainer>
            </MetricChartCard>
          )}

          {/* Table */}
          <ModuleSectionCard title="Desglose por Arrendatario">
            <div className="overflow-x-auto">
              <table className={tableTheme.table}>
                <thead className={tableTheme.head}>
                  <tr>
                    <th className={`${tableTheme.headCell} sticky left-0 bg-brand-700`}>Arrendatario</th>
                    <th className={tableTheme.compactHeadCell}>Locales</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>GLA (m2)</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>Presupuesto (UF)</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>Real (UF)</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>Varianza (UF)</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>Varianza (%)</th>
                    <th className={`${tableTheme.compactHeadCell} text-center`}>Cumplimiento (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row, index) => {
                    const badge = achievementBadge(row.achievementPct);
                    return (
                      <tr key={row.tenantId} className={`${getStripedRowClass(index)} ${tableTheme.rowHover}`}>
                        <td className="sticky left-0 bg-inherit px-4 py-3 font-medium text-slate-800">
                          <Link
                            href={`/tenants/${row.tenantId}`}
                            className="text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
                          >
                            {row.nombreComercial}
                          </Link>
                          <p className="text-xs text-slate-400">{row.rut}</p>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-500">
                          {row.locales.map((l) => l.codigo).join(", ")}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {formatUf(row.glam2, 1)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {formatUf(row.budgetUf)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {formatUf(row.actualUf)}
                        </td>
                        <td className={cn("px-3 py-3 text-right tabular-nums", varianceColor(row.varianceUf))}>
                          {formatUf(row.varianceUf)}
                        </td>
                        <td className={cn("px-3 py-3 text-right tabular-nums", varianceColor(row.variancePct))}>
                          {formatUf(row.variancePct, 1)}%
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {summary && data.rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-brand-700 bg-slate-50 font-semibold text-slate-800">
                      <td className="sticky left-0 bg-slate-50 px-4 py-3">
                        Totales ({data.rows.length} arrendatarios)
                      </td>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatUf(data.rows.reduce((a, r) => a + r.glam2, 0), 1)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatUf(summary.totalBudgetUf)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatUf(summary.totalActualUf)}
                      </td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", varianceColor(summary.totalVarianceUf))}>
                        {formatUf(summary.totalVarianceUf)}
                      </td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", varianceColor(summary.totalVariancePct))}>
                        {formatUf(summary.totalVariancePct, 1)}%
                      </td>
                      <td className="px-3 py-3 text-center">
                        {(() => {
                          const badge = achievementBadge(summary.totalAchievementPct);
                          return (
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}
