"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import {
  chartAxisProps,
  chartBarRadius,
  chartColors,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  buildPeriodoTickFormatter,
  getSeriesColor,
} from "@/lib/charts/theme";
import { cn, formatPeriodoCorto, formatUf, formatUfPerM2, groupPeriodosByYear } from "@/lib/utils";
import { GROUP3_FIJO, GROUP3_VARIABLE } from "@/lib/real/facturacion-timeseries";
import type { FacturacionResponse } from "@/types/billing";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DimensionTab = "tamano" | "tipo" | "piso";
type BillingTypeFilter = "all" | "fijo" | "variable";

const DIMENSION_LABELS: Record<DimensionTab, string> = {
  tamano: "Categoría (Tamaño)",
  tipo: "Categoría (Tipo)",
  piso: "Piso"
};

const BILLING_TYPE_LABELS: Record<BillingTypeFilter, string> = {
  all: "Todos",
  fijo: "Solo Fijo",
  variable: "Solo Variable"
};

const BILLING_TYPE_GROUP3: Record<BillingTypeFilter, string | undefined> = {
  all: undefined,
  fijo: GROUP3_FIJO,
  variable: GROUP3_VARIABLE
};

const compactTheme = getTableTheme("compact");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function valueCls(v: number): string {
  if (v === 0) return "text-slate-300";
  return v < 0 ? "text-red-600" : "text-slate-800";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

export function FacturacionClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [dimension, setDimension] = useState<DimensionTab>("tamano");
  const [billingType, setBillingType] = useState<BillingTypeFilter>("all");
  const [breakdown, setBreakdown] = useState(false);
  const [chartView, setChartView] = useState<"lines" | "bars">("lines");

  const [data, setData] = useState<FacturacionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        dimension,
        breakdown: String(breakdown)
      });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const g3 = BILLING_TYPE_GROUP3[billingType];
      if (g3) params.set("group3Filter", g3);
      const res = await fetch(`/api/real/billing?${params}`);
      if (res.ok) {
        setData((await res.json()) as FacturacionResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dimension, billingType, breakdown, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const periods = data?.periods ?? [];
  const yearGroups = groupPeriodosByYear(periods);
  const series = data?.series ?? [];
  const totals = data?.totals ?? [];
  const dimensionKeys = series.map((s) => s.dimension);

  // Build chart data
  const chartData = periods.map((p, i) => {
    const entry: Record<string, string | number> = { periodo: p };
    for (const s of series) {
      entry[s.dimension] = s.data[i]?.ufPerM2 ?? 0;
    }
    entry["Total UF/m²"] = totals[i]?.ufPerM2 ?? 0;
    return entry;
  });

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Facturación Mensual (UF/m²)"
        description="Intensidad de facturación por dimensión. Replica la hoja 'Facturación' del CDG."
        valueBadges={["efectivo"]}
        actions={
          <ProjectPeriodToolbar
            desde={desde}
            hasta={hasta}
            onDesdeChange={setDesde}
            onHastaChange={setHasta}
          />
        }
      />

      {/* Controls */}
      <ModuleSectionCard>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Ver por</span>
            {(Object.keys(DIMENSION_LABELS) as DimensionTab[]).map((d) => (
              <button
                key={d}
                onClick={() => setDimension(d)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  dimension === d
                    ? "bg-brand-700 text-white"
                    : "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
                )}
              >
                {DIMENSION_LABELS[d]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Tipo ingreso</span>
            {(Object.keys(BILLING_TYPE_LABELS) as BillingTypeFilter[]).map((bt) => (
              <button
                key={bt}
                onClick={() => setBillingType(bt)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  billingType === bt
                    ? "bg-brand-700 text-white"
                    : "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
                )}
              >
                {BILLING_TYPE_LABELS[bt]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={breakdown}
              onChange={(e) => setBreakdown(e.target.checked)}
              className="rounded border-slate-300"
            />
            Desglose por tipo cobro
          </label>
        </div>
      </ModuleSectionCard>

      {/* Content */}
      {loading ? (
        <ModuleLoadingState message="Cargando facturación..." />
      ) : !data || series.length === 0 ? (
        <ModuleEmptyState
          message="Sin datos de facturación para el rango seleccionado."
          actionHref="/imports"
          actionLabel="Cargar datos contables"
        />
      ) : (
        <>
          {/* Chart */}
          <MetricChartCard
            title={`Facturación${billingType !== "all" ? ` ${BILLING_TYPE_LABELS[billingType]}` : " All-In"} (UF/m²) por ${DIMENSION_LABELS[dimension]}`}
            metricId="chart_finance_occupancy"
            description={`${chartView === "lines" ? "Líneas" : "Barras"}: UF/m² por dimensión. Línea gruesa: total UF/m².`}
            actions={
              <div className="flex overflow-hidden rounded-md border border-slate-200">
                {(["lines", "bars"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setChartView(v)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium transition-colors",
                      chartView === v
                        ? "bg-brand-700 text-white"
                        : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {v === "lines" ? "Líneas" : "Barras"}
                  </button>
                ))}
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={chartHeight.lg}>
              <ComposedChart data={chartData} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
                <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v)} />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => formatPeriodoCorto(String(l))}
                      valueFormatter={(value) => {
                        const v = typeof value === "number" ? value : Number(value ?? 0);
                        return formatUfPerM2(v);
                      }}
                    />
                  }
                />
                <Legend {...chartLegendProps} />
                {chartView === "lines"
                  ? dimensionKeys.map((key, i) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={key}
                        stroke={getSeriesColor(i)}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                    ))
                  : dimensionKeys.map((key, i) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        name={key}
                        fill={getSeriesColor(i)}
                        radius={chartBarRadius}
                        maxBarSize={5}
                      />
                    ))}
                <Line
                  type="monotone"
                  dataKey="Total UF/m²"
                  name="Total UF/m²"
                  stroke={chartColors.brandDark}
                  strokeDasharray="6 3"
                  dot={false}
                  strokeWidth={2.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* Fijo vs Variable chart */}
          {data.billingTypeTotals.length > 0 && (
            <FijoVsVariableChart
              billingTypeTotals={data.billingTypeTotals}
              periods={periods}
            />
          )}

          {/* Table */}
          <ModuleSectionCard>
            <UnifiedTable
              density="compact"
              toolbar={
                <p className="text-xs text-slate-400">
                  {series.length} dimensiones · {periods.length} periodos
                </p>
              }
            >
              <table className={`${compactTheme.table} text-xs border-collapse`}>
                <thead className={compactTheme.head}>
                  {yearGroups.length > 1 && (
                    <tr className="bg-brand-700">
                      <th className="sticky left-0 z-10 bg-brand-700 py-0.5 border-r border-white/10" />
                      {yearGroups.map(({ year, count }, idx) => (
                        <th key={year} colSpan={count} className={cn("py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-white/30", idx > 0 && "border-l border-white/15")}>
                          {year}
                        </th>
                      ))}
                    </tr>
                  )}
                  <tr>
                    <th className={cn(compactTheme.headCell, "sticky left-0 z-10 bg-brand-700 pl-4 pr-3 border-r border-white/10")}>
                      {DIMENSION_LABELS[dimension]}
                    </th>
                    {periods.map((p) => (
                      <th key={p} className={cn(compactTheme.compactHeadCell, "min-w-[80px] text-right border-r border-white/10")}>
                        {formatPeriodoCorto(p)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {series.map((s, idx) => (
                    <tr
                      key={s.dimension}
                      className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}
                    >
                      <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
                        {s.dimension}
                      </td>
                      {s.data.map((d) => (
                        <td key={d.period} className={cn("px-2 py-1.5 text-right border-r border-slate-100", valueCls(d.ufPerM2))}>
                          {formatUfPerM2(d.ufPerM2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 border-brand-600 bg-brand-700 text-white hover:bg-brand-700">
                    <td className="sticky left-0 bg-brand-700 py-2 pl-4 pr-3 text-xs font-bold uppercase tracking-wide">
                      Total
                    </td>
                    {totals.map((t) => (
                      <td key={t.period} className="px-2 py-2 text-right text-xs font-bold border-r border-white/15">
                        {formatUfPerM2(t.ufPerM2)}
                      </td>
                    ))}
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

// ---------------------------------------------------------------------------
// Fijo vs Variable chart (chart36)
// ---------------------------------------------------------------------------

type FijoVsVariableProps = {
  billingTypeTotals: import("@/types/billing").BillingTypeTotalsPoint[];
  periods: string[];
};

function FijoVsVariableChart({ billingTypeTotals, periods }: FijoVsVariableProps): JSX.Element {
  const chartData = periods.map((p, i) => {
    const t = billingTypeTotals[i];
    return {
      periodo: p,
      Fijo: t?.fijoUfPerM2 ?? 0,
      Variable: t?.variableUfPerM2 ?? 0,
      "% Fijo": (t?.pctFijo ?? 0) * 100
    };
  });

  return (
    <MetricChartCard
      title="Ingreso Fijo vs Variable (UF/m²) y % Fijo"
      metricId="chart_fijo_vs_variable"
      description="Barras: UF/m² de arriendo fijo y variable. Línea: participación del ingreso fijo (eje der.)."
    >
      <ResponsiveContainer width="100%" height={chartHeight.md}>
        <ComposedChart data={chartData} margin={chartMargins.default}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
          <YAxis yAxisId="left" {...chartAxisProps} tickFormatter={(v: number) => formatUfPerM2(v)} />
          <YAxis yAxisId="right" orientation="right" {...chartAxisProps} tickFormatter={(v: number) => `${v.toFixed(0)}%`} domain={[0, 100]} />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(l) => formatPeriodoCorto(String(l))}
                valueFormatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value ?? 0);
                  return name === "% Fijo" ? `${v.toFixed(1)}%` : formatUfPerM2(v);
                }}
              />
            }
          />
          <Legend {...chartLegendProps} />
          <Bar yAxisId="left" dataKey="Fijo" name="Fijo" fill={chartColors.brandPrimary} radius={chartBarRadius} maxBarSize={18} />
          <Bar yAxisId="left" dataKey="Variable" name="Variable" fill={chartColors.goldLight} radius={chartBarRadius} maxBarSize={18} />
          <Line yAxisId="right" type="monotone" dataKey="% Fijo" name="% Fijo" stroke={chartColors.brandDark} strokeWidth={2} dot={false} strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </MetricChartCard>
  );
}
