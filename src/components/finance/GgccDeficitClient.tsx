"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "@/lib/charts/theme";
import { cn } from "@/lib/utils";
import type { GgccDeficitResponse, GgccDeficitPeriodRow } from "@/types/ggcc-deficit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const compactTheme = getTableTheme("compact");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUf(v: number): string {
  return v.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function deficitColorCls(v: number): string {
  if (v >= 0) return "text-emerald-700 font-semibold";
  if (v > -10) return "text-amber-700 font-semibold";
  return "text-red-700 font-semibold";
}

function deficitUfCls(v: number): string {
  if (v >= 0) return "text-emerald-700";
  return "text-red-700";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

export function GgccDeficitClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");

  const [data, setData] = useState<GgccDeficitResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/finance/ggcc?${params}`);
      if (res.ok) {
        setData((await res.json()) as GgccDeficitResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const periods = data?.periods ?? [];
  const overall = data?.overall ?? [];
  const bySize = data?.bySize ?? [];
  const manoDeObraRatio = data?.manoDeObraIngresosRatio ?? {};

  // Build chart data for overall deficit
  const chartData = overall.map((row) => ({
    mes: row.period.slice(5),
    "Recuperacion": row.recoveryUf,
    "Costo": row.costUf,
    "Deficit %": row.deficitPct
  }));

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Gastos Comunes (GG.CC.)"
        description="Recuperacion vs costos operacionales. Replica la hoja 'GG.CC.' del CDG."
        actions={
          <ProjectPeriodToolbar
            desde={desde}
            hasta={hasta}
            onDesdeChange={setDesde}
            onHastaChange={setHasta}
          />
        }
      />

      {/* Content */}
      {loading ? (
        <ModuleLoadingState message="Cargando gastos comunes..." />
      ) : !data || overall.length === 0 ? (
        <ModuleEmptyState
          message="Sin datos de gastos comunes para el rango seleccionado."
          actionHref="/finance/upload"
          actionLabel="Cargar datos contables"
        />
      ) : (
        <>
          {/* KPI summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(() => {
              const lastRow = overall[overall.length - 1];
              if (!lastRow) return null;
              const items = [
                { label: "Recuperacion", value: fmtUf(lastRow.recoveryUf), cls: "text-slate-800" },
                { label: "Costo Total", value: fmtUf(lastRow.costUf), cls: "text-slate-800" },
                { label: "Deficit UF", value: fmtUf(lastRow.deficitUf), cls: deficitUfCls(lastRow.deficitUf) },
                { label: "Deficit %", value: fmtPct(lastRow.deficitPct), cls: deficitColorCls(lastRow.deficitPct) },
                { label: "MdO / Ingresos", value: fmtPct(manoDeObraRatio[lastRow.period] ?? 0), cls: "text-slate-800" }
              ];
              return items.map((item) => (
                <div key={item.label} className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className={cn("mt-1 text-lg font-bold", item.cls)}>{item.value}</p>
                  <p className="text-[10px] text-slate-400">Periodo: {lastRow.period}</p>
                </div>
              ));
            })()}
          </div>

          {/* Chart */}
          <MetricChartCard
            title="Recuperacion vs Costo (UF)"
            metricId="chart_finance_ggcc"
            description="Barras: recuperacion y costo en UF. Linea: deficit %."
          >
            <ResponsiveContainer width="100%" height={chartHeight.lg}>
              <ComposedChart data={chartData} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="mes" {...chartAxisProps} />
                <YAxis yAxisId="left" {...chartAxisProps} tickFormatter={(v: number) => v.toLocaleString("es-CL")} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...chartAxisProps}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => `Mes: ${String(l)}`}
                      valueFormatter={(value, name) => {
                        const v = typeof value === "number" ? value : Number(value ?? 0);
                        const label = String(name ?? "");
                        if (label.includes("%")) return `${v.toFixed(1)}%`;
                        return v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
                      }}
                    />
                  }
                />
                <Legend {...chartLegendProps} />
                <Bar yAxisId="left" dataKey="Recuperacion" name="Recuperacion" fill={chartColors.positive} radius={chartBarRadius} />
                <Bar yAxisId="left" dataKey="Costo" name="Costo" fill={chartColors.negative} radius={chartBarRadius} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Deficit %"
                  name="Deficit %"
                  stroke={chartColors.brandPrimary}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* Overall table */}
          <ModuleSectionCard>
            <UnifiedTable
              density="compact"
              toolbar={
                <p className="text-xs text-slate-400">
                  Resumen general &middot; {periods.length} periodos
                </p>
              }
            >
              <div className="overflow-x-auto">
                <table className={`${compactTheme.table} text-xs`}>
                  <thead className={compactTheme.head}>
                    <tr>
                      <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                        Concepto
                      </th>
                      {periods.map((p) => (
                        <th key={p} className={`${compactTheme.compactHeadCell} min-w-[90px] text-right`}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {renderConceptRow("Recuperacion", overall, (r) => r.recoveryUf, "text-slate-700", 0)}
                    {renderConceptRow("Costo Total", overall, (r) => r.costUf, "text-slate-700", 1)}
                    {renderConceptRow("Deficit UF", overall, (r) => r.deficitUf, "", 2, true)}
                    {renderConceptRow("Deficit %", overall, (r) => r.deficitPct, "", 3, false, true)}
                    {renderConceptRow("Recuperacion UF/m\u00B2", overall, (r) => r.recoveryUfM2, "text-slate-600", 4)}
                    {renderConceptRow("Costo UF/m\u00B2", overall, (r) => r.costUfM2, "text-slate-600", 5)}
                    {renderConceptRow("Deficit UF/m\u00B2", overall, (r) => r.deficitUfM2, "", 6, true)}
                  </tbody>
                </table>
              </div>
            </UnifiedTable>
          </ModuleSectionCard>

          {/* Cost breakdown */}
          <ModuleSectionCard>
            <UnifiedTable
              density="compact"
              toolbar={<p className="text-xs text-slate-400">Desglose de costos</p>}
            >
              <div className="overflow-x-auto">
                <table className={`${compactTheme.table} text-xs`}>
                  <thead className={compactTheme.head}>
                    <tr>
                      <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                        Componente
                      </th>
                      {periods.map((p) => (
                        <th key={p} className={`${compactTheme.compactHeadCell} min-w-[90px] text-right`}>
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {renderBreakdownRow("Contribuciones", overall, (r) => r.costBreakdown.contribuciones, 0)}
                    {renderBreakdownRow("Gastos Operaciones", overall, (r) => r.costBreakdown.gastosOperaciones, 1)}
                    {renderBreakdownRow("Mano de Obra", overall, (r) => r.costBreakdown.manoDeObra, 2)}
                    {renderBreakdownRow("Gastos Admin", overall, (r) => r.costBreakdown.gastosAdmin, 3)}
                    <tr className="border-t-2 border-brand-600 bg-brand-700 text-white hover:bg-brand-700">
                      <td className="sticky left-0 bg-brand-700 py-2 pl-4 pr-3 text-xs font-bold uppercase tracking-wide">
                        Total
                      </td>
                      {overall.map((r) => (
                        <td key={r.period} className="px-2 py-2 text-right text-xs font-bold">
                          {fmtUf(r.costUf)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </UnifiedTable>
          </ModuleSectionCard>

          {/* By size dimension */}
          {bySize.length > 0 && (
            <ModuleSectionCard>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Deficit por Tamano</h3>
              <div className="space-y-4">
                {bySize.map((dim) => (
                  <div key={dim.dimension}>
                    <p className="mb-1 text-xs font-medium text-slate-500">{dim.dimension}</p>
                    <div className="overflow-x-auto">
                      <table className={`${compactTheme.table} text-xs`}>
                        <thead className={compactTheme.head}>
                          <tr>
                            <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                              Concepto
                            </th>
                            {periods.map((p) => (
                              <th key={p} className={`${compactTheme.compactHeadCell} min-w-[90px] text-right`}>
                                {p}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {renderConceptRow("Recuperacion", dim.rows, (r) => r.recoveryUf, "text-slate-700", 0)}
                          {renderConceptRow("Costo", dim.rows, (r) => r.costUf, "text-slate-700", 1)}
                          {renderConceptRow("Deficit UF", dim.rows, (r) => r.deficitUf, "", 2, true)}
                          {renderConceptRow("Deficit %", dim.rows, (r) => r.deficitPct, "", 3, false, true)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </ModuleSectionCard>
          )}

          {/* Mano de Obra / Ingresos ratio */}
          {Object.keys(manoDeObraRatio).length > 0 && (
            <ModuleSectionCard>
              <UnifiedTable
                density="compact"
                toolbar={<p className="text-xs text-slate-400">Mano de Obra / Ingresos</p>}
              >
                <div className="overflow-x-auto">
                  <table className={`${compactTheme.table} text-xs`}>
                    <thead className={compactTheme.head}>
                      <tr>
                        <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                          Indicador
                        </th>
                        {periods.map((p) => (
                          <th key={p} className={`${compactTheme.compactHeadCell} min-w-[90px] text-right`}>
                            {p}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={`${getStripedRowClass(0, "compact")} ${compactTheme.rowHover}`}>
                        <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
                          MdO / Ingresos %
                        </td>
                        {periods.map((p) => (
                          <td key={p} className="px-2 py-1.5 text-right text-slate-700">
                            {fmtPct(manoDeObraRatio[p] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </UnifiedTable>
            </ModuleSectionCard>
          )}
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Row renderers
// ---------------------------------------------------------------------------

function renderConceptRow(
  label: string,
  rows: GgccDeficitPeriodRow[],
  getValue: (r: GgccDeficitPeriodRow) => number,
  baseCls: string,
  idx: number,
  isDeficitUf = false,
  isDeficitPct = false
): JSX.Element {
  return (
    <tr className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}>
      <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
        {label}
      </td>
      {rows.map((r) => {
        const v = getValue(r);
        let cls = baseCls;
        if (isDeficitUf) cls = deficitUfCls(v);
        if (isDeficitPct) cls = deficitColorCls(v);
        return (
          <td key={r.period} className={cn("px-2 py-1.5 text-right", cls)}>
            {isDeficitPct ? fmtPct(v) : fmtUf(v)}
          </td>
        );
      })}
    </tr>
  );
}

function renderBreakdownRow(
  label: string,
  rows: GgccDeficitPeriodRow[],
  getValue: (r: GgccDeficitPeriodRow) => number,
  idx: number
): JSX.Element {
  return (
    <tr className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}>
      <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
        {label}
      </td>
      {rows.map((r) => (
        <td key={r.period} className="px-2 py-1.5 text-right text-slate-600">
          {fmtUf(getValue(r))}
        </td>
      ))}
    </tr>
  );
}
