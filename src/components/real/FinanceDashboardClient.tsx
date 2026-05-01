"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
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
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { KpiCard as SharedKpiCard } from "@/components/dashboard/KpiCard";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
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
  chartGradientGroup,
  gradientId,
  chartSeriesColors,
  buildPeriodoTickFormatter,
} from "@/lib/charts/theme";
import { formatEerr, BELOW_EBITDA_GROUPS } from "@/lib/real/eerr";
import { getVarianceTone, TONE_TEXT_CLASS } from "@/lib/real/value-tone";
import { cn, formatPercent, formatPeriodoCorto, formatUf } from "@/lib/utils";
import type { MetricFormulaId } from "@/lib/metric-formulas";
import { PanelCdg } from "@/components/real/PanelCdg";
import { DeltaPill } from "@/components/ui/DeltaPill";
import type { PanelCdgKpi, PanelCdgUnit } from "@/types/panel-cdg";

type Modo = "mes" | "año" | "ltm";

type Kpis = {
  ingresos: { actual: number; anterior: number };
  ebitda: { actual: number; anterior: number; margenPct: number | null };
  ytdIngresos: { actual: number; anterior: number } | null;
  ytdEbitda: { actual: number; anterior: number } | null;
};

type DashboardData = {
  kpis: Kpis;
  grafico: { meses: string[]; ingresosActual: number[]; ingresosAnterior: number[]; ebitdaActual: number[] };
  seccionesEerr: { grupo1: string; actual: number; anterior: number }[];
  panel: PanelCdgKpi[];
};

type Props = {
  selectedProjectId: string;
  reportDate: string | null;
};

type AnyRecord = Record<string, unknown>;
const compactTableTheme = getTableTheme("compact");

function asRecord(value: unknown): AnyRecord | null {
  return value !== null && typeof value === "object" ? (value as AnyRecord) : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => asNumber(item)).filter((item) => Number.isFinite(item))
    : [];
}

function normalizeDashboardData(raw: unknown): DashboardData | null {
  const root = asRecord(raw);
  if (!root) return null;

  const kpisRaw = asRecord(root.kpis);
  const chartRaw = asRecord(root.grafico) ?? asRecord(root.chart);
  const sectionsRaw = root.seccionesEerr ?? root.sectionsEerr;
  if (!kpisRaw || !chartRaw) return null;

  const ingresosRaw = asRecord(kpisRaw.ingresos) ?? asRecord(kpisRaw.income);
  const ebitdaRaw = asRecord(kpisRaw.ebitda);
  if (!ingresosRaw || !ebitdaRaw) return null;

  const ytdIngresosRaw = asRecord(kpisRaw.ytdIngresos) ?? asRecord(kpisRaw.ytdIncome);
  const ytdEbitdaRaw = asRecord(kpisRaw.ytdEbitda);

  return {
    kpis: {
      ingresos: {
        actual: asNumber(ingresosRaw.actual ?? ingresosRaw.current),
        anterior: asNumber(ingresosRaw.anterior ?? ingresosRaw.prior)
      },
      ebitda: {
        actual: asNumber(ebitdaRaw.actual ?? ebitdaRaw.current),
        anterior: asNumber(ebitdaRaw.anterior ?? ebitdaRaw.prior),
        margenPct: asNullableNumber(ebitdaRaw.margenPct ?? ebitdaRaw.marginPct)
      },
      ytdIngresos: ytdIngresosRaw
        ? {
            actual: asNumber(ytdIngresosRaw.actual ?? ytdIngresosRaw.current),
            anterior: asNumber(ytdIngresosRaw.anterior ?? ytdIngresosRaw.prior)
          }
        : null,
      ytdEbitda: ytdEbitdaRaw
        ? {
            actual: asNumber(ytdEbitdaRaw.actual ?? ytdEbitdaRaw.current),
            anterior: asNumber(ytdEbitdaRaw.anterior ?? ytdEbitdaRaw.prior)
          }
        : null
    },
    grafico: {
      meses: asStringArray(chartRaw.meses ?? chartRaw.months),
      ingresosActual: asNumberArray(chartRaw.ingresosActual ?? chartRaw.currentIncome),
      ingresosAnterior: asNumberArray(chartRaw.ingresosAnterior ?? chartRaw.priorIncome),
      ebitdaActual: asNumberArray(chartRaw.ebitdaActual ?? chartRaw.currentEbitda)
    },
    seccionesEerr: Array.isArray(sectionsRaw)
      ? sectionsRaw
          .map((item) => {
            const s = asRecord(item);
            if (!s) return null;
            const sectionName =
              typeof s.grupo1 === "string"
                ? s.grupo1
                : typeof s.group1 === "string"
                  ? s.group1
                  : null;
            if (!sectionName) return null;
            return {
              grupo1: sectionName,
              actual: asNumber(s.actual ?? s.current),
              anterior: asNumber(s.anterior ?? s.prior)
            };
          })
          .filter((item): item is { grupo1: string; actual: number; anterior: number } => item !== null)
      : [],
    panel: normalizePanel(root.panel)
  };
}

const PANEL_UNITS: PanelCdgUnit[] = ["uf", "m2", "pct", "uf_m2"];

function normalizePanelCell(raw: unknown): {
  real: number | null;
  ppto: number | null;
  prior: number | null;
  yoy: number | null;
} {
  const cell = asRecord(raw);
  return {
    real: cell ? asNullableNumber(cell.real) : null,
    ppto: cell ? asNullableNumber(cell.ppto) : null,
    prior: cell ? asNullableNumber(cell.prior) : null,
    yoy: cell ? asNullableNumber(cell.yoy) : null
  };
}

function normalizePanel(raw: unknown): PanelCdgKpi[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): PanelCdgKpi | null => {
      const kpi = asRecord(item);
      if (!kpi) return null;
      const key = typeof kpi.key === "string" ? kpi.key : null;
      const label = typeof kpi.label === "string" ? kpi.label : null;
      const unit = typeof kpi.unit === "string" && (PANEL_UNITS as string[]).includes(kpi.unit)
        ? (kpi.unit as PanelCdgUnit)
        : null;
      if (!key || !label || !unit) return null;
      return {
        key,
        label,
        unit,
        section: typeof kpi.section === "string" ? kpi.section : null,
        mes: normalizePanelCell(kpi.mes),
        ytd: normalizePanelCell(kpi.ytd)
      };
    })
    .filter((item): item is PanelCdgKpi => item !== null);
}

// Section ordering for EE.RR summary
const SECTION_ORDER = [
  "INGRESOS DE EXPLOTACION",
  "VACANCIA G.C. + CONTRIBUCIONES",
  "GASTOS MARKETING",
  "GASTOS INMOBILIARIA",
  "DEPRECIACION",
  "EDI",
  "RESULTADO NO OPERACIONAL",
  "IMPUESTOS"
];

function deltaCls(delta: number): string {
  return TONE_TEXT_CLASS[getVarianceTone("ingreso", delta)];
}

function deltaSign(v: number): string {
  if (v > 0) return `+${formatEerr(v)}`;
  if (v < 0) return formatEerr(v);
  return "\u2014";
}

function deltaPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

function KpiCard({
  metricId,
  label,
  value,
  anterior,
  subLabel,
  suffix = ""
}: {
  metricId: MetricFormulaId;
  label: string;
  value: number | null;
  anterior?: number;
  subLabel?: string;
  suffix?: string;
}) {
  const delta = value !== null && anterior !== undefined ? value - anterior : null;
  const pct = value !== null && anterior !== undefined ? deltaPct(value, anterior) : null;
  const trend =
    pct !== null && delta !== null
      ? { value: pct, label: `${deltaSign(delta)} vs año ant.` }
      : undefined;
  return (
    <SharedKpiCard
      metricId={metricId}
      title={label}
      value={value !== null ? `${formatEerr(value, 1)}${suffix}` : "\u2014"}
      subtitle={subLabel}
      trend={trend}
    />
  );
}

function getModoLabel(modo: Modo, periodo: string): string {
  if (modo === "mes") return `Mes: ${periodo}`;
  if (modo === "año") return `Año: ${periodo}`;
  return `LTM: últimos 12 meses hasta ${periodo}`;
}

function currentPeriodDefault(modo: Modo): string {
  const now = new Date();
  if (modo === "año") return String(now.getFullYear());
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function FinanceDashboardClient({ selectedProjectId, reportDate }: Props): JSX.Element {
  const [modo, setModo] = useState<Modo>("mes");
  const [periodo, setPeriodo] = useState(() => currentPeriodDefault("mes"));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  // Update periodo default when modo changes
  function handleModoChange(m: Modo) {
    setModo(m);
    setPeriodo(currentPeriodDefault(m));
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId, modo, periodo });
      const res = await fetch(`/api/real/dashboard?${params}`);
      const payload = (await res.json().catch(() => null)) as unknown;
      const normalized = normalizeDashboardData(payload);
      setData(res.ok ? normalized : null);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, modo, periodo]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const chartMonths = data?.grafico?.meses ?? [];
  const chartData = chartMonths.map((m, i) => ({
    periodo: m,
    ingresosActual: data?.grafico.ingresosActual[i] ?? 0,
    ingresosAnterior: data?.grafico.ingresosAnterior[i] ?? 0,
    ebitda: data?.grafico.ebitdaActual[i] ?? 0
  }));

  const seccionesOrdenadas = data
    ? [...data.seccionesEerr].sort((a, b) => {
        const ia = SECTION_ORDER.indexOf(a.grupo1);
        const ib = SECTION_ORDER.indexOf(b.grupo1);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
    : [];

  const ingresosGradId = gradientId("ingresos");
  const ebitdaGradId = gradientId("ebitda");

  return (
    <main className="stagger space-y-4">
      <ModuleHeader
        overline="Realidad"
        title="Dashboard de Operación"
        description="Resumen ejecutivo del proyecto por periodo: ingresos, EBITDA y evolución mensual observada."
        asOf={reportDate}
        actions={
          <div className="flex items-center gap-3">
            {/* Modo */}
            <div className="flex overflow-hidden rounded-sm border border-surface-200 bg-white text-xs font-medium">
              {(["mes", "año", "ltm"] as Modo[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModoChange(m)}
                  className={cn(
                    "px-3 py-1.5 uppercase tracking-widest transition-colors",
                    modo === m
                      ? "bg-brand-700 text-white ribbon-underline"
                      : "text-slate-500 hover:bg-brand-50 hover:text-brand-700"
                  )}
                >
                  {m === "ltm" ? "LTM" : m === "año" ? "Año" : "Mes"}
                </button>
              ))}
            </div>
            {/* Periodo input */}
            <input
              type={modo === "año" ? "number" : "month"}
              value={periodo}
              min={modo === "año" ? "2020" : undefined}
              max={modo === "año" ? String(new Date().getFullYear()) : undefined}
              onChange={(e) => setPeriodo(e.target.value)}
              className="rounded-sm border border-surface-200 bg-white px-2 py-1 text-xs text-slate-700 num focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        }
      />

      {loading ? (
        <ModuleSectionCard>
          <ModuleLoadingState message="Cargando dashboard..." />
        </ModuleSectionCard>
      ) : !data ? (
        <ModuleSectionCard>
          <ModuleEmptyState
            message="Sin datos para el periodo seleccionado."
            actionHref="/imports"
            actionLabel="Cargar datos contables"
          />
        </ModuleSectionCard>
      ) : (
        <>
          <PanelCdg kpis={data.panel} reportDate={reportDate} />

          {/* KPI Cards — Real: ingresos, EBITDA, YTD. UF/m² y vacancia viven en /plan/dashboard. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              metricId="kpi_dashboard_ingresos_uf"
              label="Ingresos"
              value={data.kpis.ingresos.actual}
              anterior={data.kpis.ingresos.anterior}
              subLabel={getModoLabel(modo, periodo)}
            />
            <KpiCard
              metricId="kpi_dashboard_ebitda_uf"
              label="EBITDA"
              value={data.kpis.ebitda.actual}
              anterior={data.kpis.ebitda.anterior}
              subLabel={data.kpis.ebitda.margenPct !== null ? `Mg ${formatPercent(data.kpis.ebitda.margenPct)}` : undefined}
            />
            {data.kpis.ytdIngresos && (
              <KpiCard
                metricId="kpi_dashboard_ytd_ingresos_uf"
                label="YTD Ingresos"
                value={data.kpis.ytdIngresos.actual}
                anterior={data.kpis.ytdIngresos.anterior}
              />
            )}
            {data.kpis.ytdEbitda && (
              <KpiCard
                metricId="kpi_dashboard_ytd_ebitda_uf"
                label="YTD EBITDA"
                value={data.kpis.ytdEbitda.actual}
                anterior={data.kpis.ytdEbitda.anterior}
              />
            )}
          </div>

          {/* Gráfico mensual */}
          <MetricChartCard
            title="Evolucion mensual"
            metricId="chart_dashboard_ingresos_ebitda_uf"
            description="Ingresos y EBITDA (UF) con comparativo del ano anterior."
          >
            <ResponsiveContainer width="100%" height={chartHeight.md}>
              <ComposedChart data={chartData} margin={chartMargins.default}>
                <defs>
                  {chartGradientGroup([
                    { id: ingresosGradId, color: chartSeriesColors.actual },
                    { id: ebitdaGradId, color: chartSeriesColors.ebitda }
                  ])}
                </defs>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="periodo" {...chartAxisProps} tickFormatter={buildPeriodoTickFormatter(chartMonths.length)} />
                <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => formatPeriodoCorto(String(l))}
                      valueFormatter={(value) =>
                        typeof value === "number" ? formatUf(value, 0) : String(value ?? "\u2014")
                      }
                    />
                  }
                />
                <Legend {...chartLegendProps} />
                <Area
                  type="monotone"
                  dataKey="ingresosActual"
                  name="Ingresos (área)"
                  stroke="transparent"
                  fill={`url(#${ingresosGradId})`}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Bar dataKey="ingresosActual" name="Ingresos año actual" fill={chartSeriesColors.actual} radius={chartBarRadius} />
                <Bar dataKey="ebitda" name="EBITDA año actual" fill={chartSeriesColors.ebitda} radius={chartBarRadius} />
                <Line
                  type="monotone"
                  dataKey="ingresosAnterior"
                  name="Ingresos año anterior"
                  stroke={chartColors.axisMuted}
                  strokeDasharray="4 2"
                  dot={false}
                  strokeWidth={1.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* Tabla EE.RR resumen */}
          <ModuleSectionCard>
            <UnifiedTable
              density="compact"
              toolbar={
                <p className="overline text-slate-500">
                  EE.RR Resumen — actual vs año anterior (UF)
                </p>
              }
            >
              <table className={cn(compactTableTheme.table, "text-xs")}>
                <thead className={compactTableTheme.head}>
                  <tr>
                    <th className={compactTableTheme.compactHeadCell}>Sección</th>
                    <th className={cn(compactTableTheme.compactHeadCell, "text-right")}>Actual</th>
                    <th className={cn(compactTableTheme.compactHeadCell, "text-right")}>Año anterior</th>
                    <th className={cn(compactTableTheme.compactHeadCell, "text-right")}>Δ UF</th>
                    <th className={cn(compactTableTheme.compactHeadCell, "text-right")}>Δ %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200/70">
                  {seccionesOrdenadas.map((s, i) => {
                    const isBelowEbitda = BELOW_EBITDA_GROUPS.has(s.grupo1);
                    const delta = s.actual - s.anterior;
                    const pct = deltaPct(s.actual, s.anterior);
                    return (
                      <tr key={s.grupo1} className={cn(getStripedRowClass(i, "compact"), compactTableTheme.rowHover)}>
                        <td className={cn("py-2 pl-4 pr-3 font-medium", isBelowEbitda ? "text-slate-400" : "text-slate-700")}>
                          {s.grupo1}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 num">{formatEerr(s.actual)}</td>
                        <td className="px-3 py-2 text-right text-slate-400 num">{formatEerr(s.anterior)}</td>
                        <td className={cn("px-3 py-2 text-right font-medium num", deltaCls(delta))}>{deltaSign(delta)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end">
                            <DeltaPill value={pct} kind="ingreso" mode="variance" suffix="%" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </UnifiedTable>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}



