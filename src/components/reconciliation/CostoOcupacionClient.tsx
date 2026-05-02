"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import {
  chartAxisProps,
  chartGridProps,
  chartHeight,
  chartLegendProps,
  chartMargins,
  buildPeriodoTickFormatter,
  getSeriesColor
} from "@/lib/charts/theme";
import { cn, formatPercent, formatPeriodoCorto, formatUf, formatUfPerM2, getCurrentYearMonth } from "@/lib/utils";
import type {
  CostoOcupacionResponse,
  CostoOcupacionRow,
  CostoOcupacionTimeseriesResponse
} from "@/types/occupancy-cost";

const TAMANO_ORDER = [
  "Tienda Mayor",
  "Tienda Mediana",
  "Tienda Menor",
  "Espacio",
  "Modulo",
  "Bodega",
  "Sin clasificar"
];

type GroupedRows = {
  categoriaTamano: string;
  rows: CostoOcupacionRow[];
  totals: {
    glaM2: number;
    facturacionUf: number;
    ventasUf: number;
    facturacionUfM2: number;
    ventasUfM2: number;
    costoOcupacionPct: number | null;
    facturacionYtdUf: number;
    ventasYtdUf: number;
    facturacionYtdUfM2: number;
    ventasYtdUfM2: number;
    costoOcupacionYtdPct: number | null;
  };
};

function groupByTamano(rows: CostoOcupacionRow[]): GroupedRows[] {
  const buckets = new Map<string, CostoOcupacionRow[]>();
  for (const row of rows) {
    const key = row.categoriaTamano || "Sin clasificar";
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  }

  const indexOf = (k: string): number => {
    const i = TAMANO_ORDER.indexOf(k);
    return i === -1 ? TAMANO_ORDER.length : i;
  };

  return [...buckets.entries()]
    .sort((a, b) => indexOf(a[0]) - indexOf(b[0]) || a[0].localeCompare(b[0]))
    .map(([categoriaTamano, groupRows]) => {
      const glaM2 = groupRows.reduce((s, r) => s + r.glaM2, 0);
      const facturacionUf = groupRows.reduce((s, r) => s + r.facturacionUf, 0);
      const ventasUf = groupRows.reduce((s, r) => s + r.ventasUf, 0);
      const facturacionYtdUf = groupRows.reduce((s, r) => s + r.facturacionYtdUf, 0);
      const ventasYtdUf = groupRows.reduce((s, r) => s + r.ventasYtdUf, 0);
      return {
        categoriaTamano,
        rows: groupRows,
        totals: {
          glaM2,
          facturacionUf,
          ventasUf,
          facturacionUfM2: glaM2 > 0 ? facturacionUf / glaM2 : 0,
          ventasUfM2: glaM2 > 0 ? ventasUf / glaM2 : 0,
          costoOcupacionPct: ventasUf > 0 ? (facturacionUf / ventasUf) * 100 : null,
          facturacionYtdUf,
          ventasYtdUf,
          facturacionYtdUfM2: glaM2 > 0 ? facturacionYtdUf / glaM2 : 0,
          ventasYtdUfM2: glaM2 > 0 ? ventasYtdUf / glaM2 : 0,
          costoOcupacionYtdPct: ventasYtdUf > 0 ? (facturacionYtdUf / ventasYtdUf) * 100 : null
        }
      };
    });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const compactTheme = getTableTheme("compact");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPctOrDash(v: number | null): string {
  if (v === null) return "-";
  return formatPercent(v);
}

function costColorCls(pct: number | null): string {
  if (pct === null) return "text-slate-400";
  if (pct < 10) return "text-emerald-700 font-semibold";
  if (pct <= 20) return "text-amber-700 font-semibold";
  return "text-red-700 font-semibold";
}


// ---------------------------------------------------------------------------
// Group renderer
// ---------------------------------------------------------------------------

function RenderGroup({ group }: { group: GroupedRows }): JSX.Element {
  return (
    <>
      <tr className="bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
        <td className="sticky left-0 bg-slate-100 py-1.5 pl-4 pr-3" colSpan={11}>
          {group.categoriaTamano}
        </td>
      </tr>
      {group.rows.map((row, idx) => (
        <tr
          key={row.tenantId}
          className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}
        >
          <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
            {row.tenantName}
          </td>
          <td className="px-2 py-1.5 text-left text-slate-500" title={row.locales.map((l) => l.nombre).join(", ")}>
            {row.locales.map((l) => l.codigo).join(", ")}
          </td>
          <td className="px-2 py-1.5 text-right text-slate-600">{formatUf(row.glaM2, 0)}</td>
          <td className="px-2 py-1.5 text-right text-slate-700">{formatUf(row.facturacionUf, 0)}</td>
          <td className="px-2 py-1.5 text-right text-slate-700">{formatUf(row.ventasUf, 0)}</td>
          <td className="px-2 py-1.5 text-right text-slate-700">{formatUfPerM2(row.facturacionUfM2)}</td>
          <td className="px-2 py-1.5 text-right text-slate-700">{formatUfPerM2(row.ventasUfM2)}</td>
          <td className={cn("px-2 py-1.5 text-right", costColorCls(row.costoOcupacionPct))}>
            {formatPctOrDash(row.costoOcupacionPct)}
          </td>
          <td className="px-2 py-1.5 text-right text-slate-700">{formatUfPerM2(row.facturacionYtdUfM2)}</td>
          <td className="px-2 py-1.5 text-right text-slate-700">{formatUfPerM2(row.ventasYtdUfM2)}</td>
          <td className={cn("px-2 py-1.5 text-right", costColorCls(row.costoOcupacionYtdPct))}>
            {formatPctOrDash(row.costoOcupacionYtdPct)}
          </td>
        </tr>
      ))}
      <tr className="bg-slate-50 text-slate-700 font-medium">
        <td className="sticky left-0 bg-slate-50 py-1.5 pl-4 pr-3" colSpan={2}>
          Subtotal {group.categoriaTamano}
        </td>
        <td className="px-2 py-1.5 text-right">{formatUf(group.totals.glaM2, 0)}</td>
        <td className="px-2 py-1.5 text-right">{formatUf(group.totals.facturacionUf, 0)}</td>
        <td className="px-2 py-1.5 text-right">{formatUf(group.totals.ventasUf, 0)}</td>
        <td className="px-2 py-1.5 text-right">{formatUfPerM2(group.totals.facturacionUfM2)}</td>
        <td className="px-2 py-1.5 text-right">{formatUfPerM2(group.totals.ventasUfM2)}</td>
        <td className={cn("px-2 py-1.5 text-right", costColorCls(group.totals.costoOcupacionPct))}>
          {formatPctOrDash(group.totals.costoOcupacionPct)}
        </td>
        <td className="px-2 py-1.5 text-right">{formatUfPerM2(group.totals.facturacionYtdUfM2)}</td>
        <td className="px-2 py-1.5 text-right">{formatUfPerM2(group.totals.ventasYtdUfM2)}</td>
        <td className={cn("px-2 py-1.5 text-right", costColorCls(group.totals.costoOcupacionYtdPct))}>
          {formatPctOrDash(group.totals.costoOcupacionYtdPct)}
        </td>
      </tr>
    </>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  selectedProjectId: string;
  defaultPeriod?: string;
};

function periodMinus(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1 - months, 1));
  return date.toISOString().slice(0, 7);
}

export function CostoOcupacionClient({
  selectedProjectId,
  defaultPeriod
}: Props): JSX.Element {
  const [period, setPeriod] = useState(defaultPeriod ?? getCurrentYearMonth());
  const [data, setData] = useState<CostoOcupacionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tsTamano, setTsTamano] = useState<CostoOcupacionTimeseriesResponse | null>(null);
  const [tsPiso, setTsPiso] = useState<CostoOcupacionTimeseriesResponse | null>(null);

  const fetchData = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(period)) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        period
      });
      const res = await fetch(`/api/real/occupancy-cost?${params}`);
      if (res.ok) {
        setData((await res.json()) as CostoOcupacionResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, period]);

  const fetchTimeseries = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(period)) return;
    const from = periodMinus(period, 11);
    const baseParams = new URLSearchParams({
      projectId: selectedProjectId,
      mode: "timeseries",
      from,
      to: period
    });
    const [resTamano, resPiso] = await Promise.all([
      fetch(`/api/real/occupancy-cost?${baseParams}&dimension=tamano`),
      fetch(`/api/real/occupancy-cost?${baseParams}&dimension=piso`)
    ]);
    if (resTamano.ok) setTsTamano((await resTamano.json()) as CostoOcupacionTimeseriesResponse);
    if (resPiso.ok) setTsPiso((await resPiso.json()) as CostoOcupacionTimeseriesResponse);
  }, [selectedProjectId, period]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { void fetchTimeseries(); }, [fetchTimeseries]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const groups = useMemo(() => groupByTamano(rows), [rows]);
  const grandTotals = useMemo(() => {
    const glaM2 = rows.reduce((s, r) => s + r.glaM2, 0);
    const facturacionUf = rows.reduce((s, r) => s + r.facturacionUf, 0);
    const ventasUf = rows.reduce((s, r) => s + r.ventasUf, 0);
    const facturacionYtdUf = rows.reduce((s, r) => s + r.facturacionYtdUf, 0);
    const ventasYtdUf = rows.reduce((s, r) => s + r.ventasYtdUf, 0);
    return {
      glaM2,
      facturacionUf,
      ventasUf,
      facturacionUfM2: glaM2 > 0 ? facturacionUf / glaM2 : 0,
      ventasUfM2: glaM2 > 0 ? ventasUf / glaM2 : 0,
      costoOcupacionPct: ventasUf > 0 ? (facturacionUf / ventasUf) * 100 : null,
      facturacionYtdUf,
      ventasYtdUf,
      facturacionYtdUfM2: glaM2 > 0 ? facturacionYtdUf / glaM2 : 0,
      ventasYtdUfM2: glaM2 > 0 ? ventasYtdUf / glaM2 : 0,
      costoOcupacionYtdPct: ventasYtdUf > 0 ? (facturacionYtdUf / ventasYtdUf) * 100 : null
    };
  }, [rows]);

  function buildTsChartData(ts: CostoOcupacionTimeseriesResponse): Record<string, string | number | null>[] {
    return ts.periods.map((p, i) => {
      const entry: Record<string, string | number | null> = { periodo: p };
      for (const s of ts.series) {
        entry[s.dimension] = s.data[i] ?? null;
      }
      return entry;
    });
  }

  const tsTamanoChart = tsTamano ? buildTsChartData(tsTamano) : [];
  const tsPisoChart = tsPiso ? buildTsChartData(tsPiso) : [];

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Costo de Ocupacion (%)"
        description="Facturacion vs ventas por arrendatario. Replica la hoja 'Costo Ocupacion' del CDG."
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Periodo</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs"
            />
          </div>
        }
      />

      {/* chart13 — Costo Ocupación por Categoría (%) */}
      {tsTamanoChart.length > 0 && tsTamano && (
        <MetricChartCard
          title="Costo de Ocupación por Categoría (%)"
          metricId="chart_costo_ocupacion_by_tamano"
          description="Evolución mensual del costo de ocupación por categoría de tamaño de local (últimos 12 meses)."
        >
          <ResponsiveContainer width="100%" height={chartHeight.md}>
            <LineChart data={tsTamanoChart} margin={chartMargins.default}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(tsTamano.periods.length)} />
              <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatPercent(v)} domain={[0, "auto"]} />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => formatPeriodoCorto(String(l))}
                    valueFormatter={(value) => {
                      const v = typeof value === "number" ? value : Number(value ?? 0);
                      return formatPercent(v);
                    }}
                  />
                }
              />
              <Legend {...chartLegendProps} />
              {tsTamano.series.map((s, i) => (
                <Line
                  key={s.dimension}
                  type="monotone"
                  dataKey={s.dimension}
                  name={s.dimension}
                  stroke={getSeriesColor(i)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </MetricChartCard>
      )}

      {/* chart14 — Costo Ocupación por Piso (%) */}
      {tsPisoChart.length > 0 && tsPiso && (
        <MetricChartCard
          title="Costo de Ocupación por Piso (%)"
          metricId="chart_costo_ocupacion_by_piso"
          description="Evolución mensual del costo de ocupación por piso del mall (últimos 12 meses)."
        >
          <ResponsiveContainer width="100%" height={chartHeight.md}>
            <LineChart data={tsPisoChart} margin={chartMargins.default}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(tsPiso.periods.length)} />
              <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatPercent(v)} domain={[0, "auto"]} />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => formatPeriodoCorto(String(l))}
                    valueFormatter={(value) => {
                      const v = typeof value === "number" ? value : Number(value ?? 0);
                      return formatPercent(v);
                    }}
                  />
                }
              />
              <Legend {...chartLegendProps} />
              {tsPiso.series.map((s, i) => (
                <Line
                  key={s.dimension}
                  type="monotone"
                  dataKey={s.dimension}
                  name={s.dimension}
                  stroke={getSeriesColor(i)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </MetricChartCard>
      )}

      {/* Content */}
      {loading ? (
        <ModuleLoadingState message="Cargando costo de ocupacion..." />
      ) : !data || rows.length === 0 ? (
        <ModuleEmptyState
          message="Sin datos de costo de ocupacion para el periodo seleccionado."
          actionHref="/imports"
          actionLabel="Cargar datos contables"
        />
      ) : (
        <ModuleSectionCard>
          <UnifiedTable
            density="compact"
            toolbar={
              <p className="text-xs text-slate-400">
                {rows.length} arrendatarios &middot; Periodo: {data.period} &middot; YTD desde {data.ytdFrom}
              </p>
            }
          >
            <div className="overflow-x-auto">
              <table className={`${compactTheme.table} text-xs`}>
                <thead className={compactTheme.head}>
                  <tr>
                    <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3 min-w-[180px]`}>
                      Arrendatario
                    </th>
                    <th className={`${compactTheme.compactHeadCell} min-w-[100px] text-left`}>
                      Locales
                    </th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>m&sup2;</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Fact. UF</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Ventas UF</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Fact. UF/m&sup2;</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Ventas UF/m&sup2;</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Costo Ocup. %</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Fact. YTD UF/m&sup2;</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Ventas YTD UF/m&sup2;</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Costo YTD %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groups.map((group) => (
                    <RenderGroup key={group.categoriaTamano} group={group} />
                  ))}
                  <tr className="bg-brand-50 font-semibold text-slate-800">
                    <td className="sticky left-0 bg-brand-50 py-2 pl-4 pr-3" colSpan={2}>
                      Total
                    </td>
                    <td className="px-2 py-2 text-right">{formatUf(grandTotals.glaM2, 0)}</td>
                    <td className="px-2 py-2 text-right">{formatUf(grandTotals.facturacionUf, 0)}</td>
                    <td className="px-2 py-2 text-right">{formatUf(grandTotals.ventasUf, 0)}</td>
                    <td className="px-2 py-2 text-right">{formatUfPerM2(grandTotals.facturacionUfM2)}</td>
                    <td className="px-2 py-2 text-right">{formatUfPerM2(grandTotals.ventasUfM2)}</td>
                    <td className={cn("px-2 py-2 text-right", costColorCls(grandTotals.costoOcupacionPct))}>
                      {formatPctOrDash(grandTotals.costoOcupacionPct)}
                    </td>
                    <td className="px-2 py-2 text-right">{formatUfPerM2(grandTotals.facturacionYtdUfM2)}</td>
                    <td className="px-2 py-2 text-right">{formatUfPerM2(grandTotals.ventasYtdUfM2)}</td>
                    <td className={cn("px-2 py-2 text-right", costColorCls(grandTotals.costoOcupacionYtdPct))}>
                      {formatPctOrDash(grandTotals.costoOcupacionYtdPct)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UnifiedTable>
        </ModuleSectionCard>
      )}
    </main>
  );
}
