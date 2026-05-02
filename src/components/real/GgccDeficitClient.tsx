"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { NoteIndicator } from "@/components/notes/NoteIndicator";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { YearGroupHeaderRow } from "@/components/ui/YearGroupHeaderRow";
import { useNotesApi } from "@/hooks/useNotesApi";
import { toLineKey } from "@/lib/notes/line-keys";
import type { AnalysisNoteRow } from "@/types/notes";
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
import { cn, formatPercent, formatPeriodoCorto, formatUf, groupPeriodosByYear } from "@/lib/utils";
import type { GgccDeficitResponse, GgccDeficitPeriodRow } from "@/types/ggcc-deficit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const compactTheme = getTableTheme("compact");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


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
  canEdit: boolean;
  currentUserId: string;
  isAdmin: boolean;
};

export type GgccNotesContext = {
  projectId: string;
  notesByLineKey: Map<string, AnalysisNoteRow[]>;
  canEdit: boolean;
  currentUserId: string;
  isAdmin: boolean;
  refresh: () => void;
};

export function GgccDeficitClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta,
  canEdit,
  currentUserId,
  isAdmin
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");

  const [data, setData] = useState<GgccDeficitResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const notesApi = useNotesApi();
  const [notes, setNotes] = useState<AnalysisNoteRow[]>([]);

  const loadNotes = useCallback(() => {
    void notesApi
      .listNotes({ projectId: selectedProjectId, view: "CDG" })
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [notesApi, selectedProjectId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const notesByLineKey = useMemo(() => {
    const map = new Map<string, AnalysisNoteRow[]>();
    for (const note of notes) {
      const arr = map.get(note.lineKey);
      if (arr) arr.push(note);
      else map.set(note.lineKey, [note]);
    }
    return map;
  }, [notes]);

  const notesContext: GgccNotesContext = useMemo(
    () => ({
      projectId: selectedProjectId,
      notesByLineKey,
      canEdit,
      currentUserId,
      isAdmin,
      refresh: loadNotes
    }),
    [selectedProjectId, notesByLineKey, canEdit, currentUserId, isAdmin, loadNotes]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/common-charges?${params}`);
      if (res.ok) {
        setData((await res.json()) as GgccDeficitResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const periods = data?.periods ?? [];
  const yearGroups = groupPeriodosByYear(periods);
  const overall = data?.overall ?? [];
  const bySize = data?.bySize ?? [];
  const manoDeObraRatio = data?.manoDeObraIngresosRatio ?? {};

  // Build chart data for overall deficit
  const chartData = overall.map((row) => ({
    periodo: row.period,
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
          actionHref="/imports"
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
                { label: "Recuperacion", value: formatUf(lastRow.recoveryUf), cls: "text-slate-800" },
                { label: "Costo Total", value: formatUf(lastRow.costUf), cls: "text-slate-800" },
                { label: "Deficit UF", value: formatUf(lastRow.deficitUf), cls: deficitUfCls(lastRow.deficitUf) },
                { label: "Deficit %", value: formatPercent(lastRow.deficitPct), cls: deficitColorCls(lastRow.deficitPct) },
                { label: "MdO / Ingresos", value: formatPercent(manoDeObraRatio[lastRow.period] ?? 0), cls: "text-slate-800" }
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
                <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
                <YAxis yAxisId="left" {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  {...chartAxisProps}
                  tickFormatter={(v: number) => formatPercent(v, 0)}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => formatPeriodoCorto(String(l))}
                      valueFormatter={(value, name) => {
                        const v = typeof value === "number" ? value : Number(value ?? 0);
                        const label = String(name ?? "");
                        if (label.includes("%")) return formatPercent(v);
                        return formatUf(v);
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

          {/* chart15 — Cost breakdown stacked bar */}
          <MetricChartCard
            title="Desglose Costos Gasto Común (UF)"
            metricId="chart_ggcc_cost_breakdown"
            description="Composición mensual del costo total de gastos comunes por categoría."
          >
            <ResponsiveContainer width="100%" height={chartHeight.md}>
              <ComposedChart data={overall.map((r) => ({
                periodo: r.period,
                "Contribuciones": Math.abs(r.costBreakdown.contribuciones),
                "Mano de Obra": Math.abs(r.costBreakdown.manoDeObra),
                "Gastos Operaciones": Math.abs(r.costBreakdown.gastosOperaciones),
                "Gastos Admin": Math.abs(r.costBreakdown.gastosAdmin),
              }))} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
                <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatPeriodoCorto(String(l))} valueFormatter={(v) => formatUf(typeof v === "number" ? v : Number(v ?? 0))} />} />
                <Legend {...chartLegendProps} />
                <Bar dataKey="Contribuciones" stackId="cost" fill={getSeriesColor(0)} radius={[0,0,0,0]} maxBarSize={20} />
                <Bar dataKey="Mano de Obra" stackId="cost" fill={getSeriesColor(1)} radius={[0,0,0,0]} maxBarSize={20} />
                <Bar dataKey="Gastos Operaciones" stackId="cost" fill={getSeriesColor(2)} radius={[0,0,0,0]} maxBarSize={20} />
                <Bar dataKey="Gastos Admin" stackId="cost" fill={getSeriesColor(3)} radius={chartBarRadius} maxBarSize={20} />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* chart38 — Recovery vs Cost per m2 */}
          <MetricChartCard
            title="Recuperación vs Costo Real GG.CC. (UF/m²)"
            metricId="chart_ggcc_recovery_vs_cost_m2"
            description="Barras: recuperación y costo en UF/m². Línea: déficit %."
          >
            <ResponsiveContainer width="100%" height={chartHeight.md}>
              <ComposedChart data={overall.map((r) => ({
                periodo: r.period,
                "Recuperación UF/m²": r.recoveryUfM2,
                "Costo UF/m²": Math.abs(r.costUfM2),
                "Deficit %": r.deficitPct,
              }))} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
                <YAxis yAxisId="left" {...chartAxisProps} tickFormatter={(v: number) => `${v.toFixed(2)}`} />
                <YAxis yAxisId="right" orientation="right" {...chartAxisProps} tickFormatter={(v: number) => formatPercent(v, 0)} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatPeriodoCorto(String(l))} valueFormatter={(v, name) => {
                  const n = typeof v === "number" ? v : Number(v ?? 0);
                  return String(name).includes("%") ? formatPercent(n) : `${n.toFixed(3)} UF/m²`;
                }} />} />
                <Legend {...chartLegendProps} />
                <Bar yAxisId="left" dataKey="Recuperación UF/m²" fill={chartColors.positive} radius={chartBarRadius} maxBarSize={18} />
                <Bar yAxisId="left" dataKey="Costo UF/m²" fill={chartColors.negative} radius={chartBarRadius} maxBarSize={18} />
                <Line yAxisId="right" type="monotone" dataKey="Deficit %" stroke={chartColors.brandPrimary} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* chart39 — Mano de Obra vs Ingresos */}
          <MetricChartCard
            title="Costo Mano de Obra vs Ingresos"
            metricId="chart_ggcc_mdo_vs_ingresos"
            description="Barras: costo de mano de obra (UF). Línea: % sobre ingresos de explotación."
          >
            <ResponsiveContainer width="100%" height={chartHeight.md}>
              <ComposedChart data={overall.map((r) => ({
                periodo: r.period,
                "Mano de Obra (UF)": Math.abs(r.costBreakdown.manoDeObra),
                "% s/ Ingresos": manoDeObraRatio[r.period] ?? 0,
              }))} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(periods.length)} />
                <YAxis yAxisId="left" {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                <YAxis yAxisId="right" orientation="right" {...chartAxisProps} tickFormatter={(v: number) => formatPercent(v, 1)} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => formatPeriodoCorto(String(l))} valueFormatter={(v, name) => {
                  const n = typeof v === "number" ? v : Number(v ?? 0);
                  return String(name).includes("%") ? formatPercent(n) : formatUf(n);
                }} />} />
                <Legend {...chartLegendProps} />
                <Bar yAxisId="left" dataKey="Mano de Obra (UF)" fill={chartColors.brandLight} radius={chartBarRadius} maxBarSize={18} />
                <Line yAxisId="right" type="monotone" dataKey="% s/ Ingresos" stroke={chartColors.brandDark} strokeWidth={2} dot={false} />
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
                <table className={`${compactTheme.table} text-xs border-collapse`}>
                  <thead className={compactTheme.head}>
                    <YearGroupHeaderRow yearGroups={yearGroups} />
                    <tr>
                      <th className={cn(compactTheme.headCell, "sticky left-0 z-10 bg-brand-700 pl-4 pr-3 border-r border-white/10")}>
                        Concepto
                      </th>
                      {periods.map((p) => (
                        <th key={p} className={cn(compactTheme.compactHeadCell, "min-w-[90px] text-right border-r border-white/10")}>
                          {formatPeriodoCorto(p)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {renderConceptRow("Recuperacion", overall, (r) => r.recoveryUf, "text-slate-700", 0, false, false, { context: notesContext, dimension: "overall" })}
                    {renderConceptRow("Costo Total", overall, (r) => r.costUf, "text-slate-700", 1, false, false, { context: notesContext, dimension: "overall" })}
                    {renderConceptRow("Deficit UF", overall, (r) => r.deficitUf, "", 2, true, false, { context: notesContext, dimension: "overall" })}
                    {renderConceptRow("Deficit %", overall, (r) => r.deficitPct, "", 3, false, true, { context: notesContext, dimension: "overall" })}
                    {renderConceptRow("Recuperacion UF/m\u00B2", overall, (r) => r.recoveryUfM2, "text-slate-600", 4, false, false, { context: notesContext, dimension: "overall" })}
                    {renderConceptRow("Costo UF/m\u00B2", overall, (r) => r.costUfM2, "text-slate-600", 5, false, false, { context: notesContext, dimension: "overall" })}
                    {renderConceptRow("Deficit UF/m\u00B2", overall, (r) => r.deficitUfM2, "", 6, true, false, { context: notesContext, dimension: "overall" })}
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
                <table className={`${compactTheme.table} text-xs border-collapse`}>
                  <thead className={compactTheme.head}>
                    <YearGroupHeaderRow yearGroups={yearGroups} />
                    <tr>
                      <th className={cn(compactTheme.headCell, "sticky left-0 z-10 bg-brand-700 pl-4 pr-3 border-r border-white/10")}>
                        Componente
                      </th>
                      {periods.map((p) => (
                        <th key={p} className={cn(compactTheme.compactHeadCell, "min-w-[90px] text-right border-r border-white/10")}>
                          {formatPeriodoCorto(p)}
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
                        <td key={r.period} className="px-2 py-2 text-right text-xs font-bold border-r border-white/15">
                          {formatUf(r.costUf)}
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
                      <table className={`${compactTheme.table} text-xs border-collapse`}>
                        <thead className={compactTheme.head}>
                          <YearGroupHeaderRow yearGroups={yearGroups} />
                          <tr>
                            <th className={cn(compactTheme.headCell, "sticky left-0 z-10 bg-brand-700 pl-4 pr-3 border-r border-white/10")}>
                              Concepto
                            </th>
                            {periods.map((p) => (
                              <th key={p} className={cn(compactTheme.compactHeadCell, "min-w-[90px] text-right border-r border-white/10")}>
                                {formatPeriodoCorto(p)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {renderConceptRow("Recuperacion", dim.rows, (r) => r.recoveryUf, "text-slate-700", 0, false, false, { context: notesContext, dimension: dim.dimension })}
                          {renderConceptRow("Costo", dim.rows, (r) => r.costUf, "text-slate-700", 1, false, false, { context: notesContext, dimension: dim.dimension })}
                          {renderConceptRow("Deficit UF", dim.rows, (r) => r.deficitUf, "", 2, true, false, { context: notesContext, dimension: dim.dimension })}
                          {renderConceptRow("Deficit %", dim.rows, (r) => r.deficitPct, "", 3, false, true, { context: notesContext, dimension: dim.dimension })}
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
                  <table className={`${compactTheme.table} text-xs border-collapse`}>
                    <thead className={compactTheme.head}>
                      <YearGroupHeaderRow yearGroups={yearGroups} />
                      <tr>
                        <th className={cn(compactTheme.headCell, "sticky left-0 z-10 bg-brand-700 pl-4 pr-3 border-r border-white/10")}>
                          Indicador
                        </th>
                        {periods.map((p) => (
                          <th key={p} className={cn(compactTheme.compactHeadCell, "min-w-[90px] text-right border-r border-white/10")}>
                            {formatPeriodoCorto(p)}
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
                          <td key={p} className="px-2 py-1.5 text-right text-slate-700 border-r border-slate-100">
                            {formatPercent(manoDeObraRatio[p] ?? 0)}
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
  isDeficitPct = false,
  notes?: { context: GgccNotesContext; dimension: string }
): JSX.Element {
  const lineKey = notes ? toLineKey("cdg", notes.dimension, label) : null;
  return (
    <tr className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}>
      <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
        <span className="inline-flex items-center gap-2">
          {notes && lineKey && (
            <NoteIndicator
              projectId={notes.context.projectId}
              view="CDG"
              lineKey={lineKey}
              notes={notes.context.notesByLineKey.get(lineKey) ?? []}
              canEdit={notes.context.canEdit}
              currentUserId={notes.context.currentUserId}
              isAdmin={notes.context.isAdmin}
              onChange={notes.context.refresh}
            />
          )}
          {label}
        </span>
      </td>
      {rows.map((r) => {
        const v = getValue(r);
        let cls = baseCls;
        if (isDeficitUf) cls = deficitUfCls(v);
        if (isDeficitPct) cls = deficitColorCls(v);
        return (
          <td key={r.period} className={cn("px-2 py-1.5 text-right border-r border-slate-100", cls)}>
            {isDeficitPct ? formatPercent(v) : formatUf(v)}
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
        <td key={r.period} className="px-2 py-1.5 text-right text-slate-600 border-r border-slate-100">
          {formatUf(getValue(r))}
        </td>
      ))}
    </tr>
  );
}
