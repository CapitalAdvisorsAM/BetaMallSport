"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import {
  chartAxisProps,
  chartColors,
  chartGridProps,
  chartHeight,
  chartMargins,
} from "@/lib/charts/theme";
import { formatDecimal, cn } from "@/lib/utils";
import type { WaterfallBar, WaterfallMode, WaterfallResponse } from "@/types/finance";

type WaterfallClientProps = {
  selectedProjectId: string;
};

type ChartDatum = {
  name: string;
  invisible: number;
  value: number;
  fill: string;
  rawValue: number;
};

function toWaterfallChartData(bars: WaterfallBar[]): ChartDatum[] {
  return bars.map((bar) => {
    if (bar.isTotal) {
      return {
        name: bar.label,
        invisible: 0,
        value: bar.value,
        fill: chartColors.brandPrimary,
        rawValue: bar.value,
      };
    }
    const base = bar.value >= 0 ? bar.cumulative : bar.cumulative + bar.value;
    return {
      name: bar.label,
      invisible: Math.max(0, base),
      value: Math.abs(bar.value),
      fill: bar.value >= 0 ? chartColors.positiveLight : chartColors.negativeLight,
      rawValue: bar.value,
    };
  });
}

function WaterfallTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDatum }> }): JSX.Element | null {
  if (!active || !payload?.[1]) return null;
  const data = payload[1].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-slate-900">{data.name}</p>
      <p className={cn("font-mono", data.rawValue >= 0 ? "text-emerald-700" : "text-rose-700")}>
        {data.rawValue >= 0 ? "+" : ""}{formatDecimal(data.rawValue)} UF
      </p>
    </div>
  );
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function WaterfallClient({
  selectedProjectId,
}: WaterfallClientProps): JSX.Element {
  const [mode, setMode] = useState<WaterfallMode>("mom");
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [data, setData] = useState<WaterfallResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        period,
        mode,
      });
      const response = await fetch(`/api/finance/waterfall?${params.toString()}`);
      if (!response.ok) return;
      const payload = (await response.json()) as WaterfallResponse;
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, period, mode]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const chartData = useMemo(
    () => (data ? toWaterfallChartData(data.bars) : []),
    [data],
  );

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Waterfall de Ingresos"
        description="Analisis de variacion de ingresos entre periodos: que causo el cambio."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
            />
            <div className="flex rounded-md border border-slate-200">
              <button
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "mom"
                    ? "bg-brand-500 text-white"
                    : "text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setMode("mom")}
              >
                Mes a Mes
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === "yoy"
                    ? "bg-brand-500 text-white"
                    : "text-slate-600 hover:bg-slate-50",
                )}
                onClick={() => setMode("yoy")}
              >
                Ano a Ano
              </button>
            </div>
          </div>
        }
      />

      {loading ? (
        <ModuleLoadingState message="Calculando waterfall..." />
      ) : !data ? (
        <ModuleSectionCard>
          <ModuleEmptyState
            message="Sin datos para el periodo seleccionado. Asegurate de haber cargado datos contables."
            actionHref="/finance/upload"
            actionLabel="Cargar datos contables"
          />
        </ModuleSectionCard>
      ) : (
        <>
          {/* KPI Row */}
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              metricId="kpi_finance_waterfall_prev"
              title="Ingreso anterior"
              value={`${formatDecimal(data.previousTotal)} UF`}
              subtitle={
                data.glaArrendadaPrevious > 0
                  ? `${(data.previousTotal / data.glaArrendadaPrevious).toLocaleString("es-CL", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} UF/m² · ${data.previousPeriod}`
                  : data.previousPeriod
              }
              accent="slate"
            />
            <KpiCard
              metricId="kpi_finance_waterfall_current"
              title="Ingreso actual"
              value={`${formatDecimal(data.currentTotal)} UF`}
              subtitle={
                data.glaArrendadaCurrent > 0
                  ? `${(data.currentTotal / data.glaArrendadaCurrent).toLocaleString("es-CL", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} UF/m² · ${data.currentPeriod}`
                  : data.currentPeriod
              }
              accent="slate"
            />
            <KpiCard
              metricId="kpi_finance_waterfall_current"
              title="Variacion neta"
              value={`${data.netChange >= 0 ? "+" : ""}${formatDecimal(data.netChange)} UF`}
              subtitle={`${data.netChangePct >= 0 ? "+" : ""}${formatDecimal(data.netChangePct)}%`}
              accent={data.netChange >= 0 ? "green" : "red"}
            />
          </section>

          {/* Waterfall Chart */}
          <MetricChartCard
            title="Analisis de variacion de ingresos"
            metricId="chart_finance_waterfall"
          >
            <ResponsiveContainer width="100%" height={chartHeight.xl}>
              <BarChart
                data={chartData}
                margin={chartMargins.compact}
              >
                <CartesianGrid {...chartGridProps} />
                <XAxis
                  dataKey="name"
                  {...chartAxisProps}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  {...chartAxisProps}
                  tickFormatter={(v: number) => formatDecimal(v)}
                />
                <Tooltip content={<WaterfallTooltip />} />
                <Bar dataKey="invisible" stackId="stack" fill="transparent" />
                <Bar dataKey="value" stackId="stack" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </MetricChartCard>
        </>
      )}
    </main>
  );
}
