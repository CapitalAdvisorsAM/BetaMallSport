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
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
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
import { formatEerr, BELOW_EBITDA_GROUPS } from "@/lib/finance/eerr";
import type { MetricFormulaId } from "@/lib/metric-formulas";

type Modo = "mes" | "año" | "ltm";

type Kpis = {
  ingresos: { actual: number; anterior: number };
  ebitda: { actual: number; anterior: number; margenPct: number | null };
  ytdIngresos: { actual: number; anterior: number } | null;
  ytdEbitda: { actual: number; anterior: number } | null;
  ufPorm2: number | null;
  vacanciaPct: number | null;
  totalLocalesGLA: number;
  localesOcupados: number;
};

type DashboardData = {
  kpis: Kpis;
  grafico: { meses: string[]; ingresosActual: number[]; ingresosAnterior: number[]; ebitdaActual: number[] };
  seccionesEerr: { grupo1: string; actual: number; anterior: number }[];
};

type Props = {
  selectedProjectId: string;
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
        : null,
      ufPorm2: asNullableNumber(kpisRaw.ufPorm2 ?? kpisRaw.ufPerM2),
      vacanciaPct: asNullableNumber(kpisRaw.vacanciaPct ?? kpisRaw.vacancyPct),
      totalLocalesGLA: asNumber(kpisRaw.totalLocalesGLA ?? kpisRaw.totalGlaUnits),
      localesOcupados: asNumber(kpisRaw.localesOcupados ?? kpisRaw.occupiedUnits)
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
      : []
  };
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
  if (delta === 0) return "text-slate-400";
  return delta > 0 ? "text-emerald-600" : "text-red-500";
}

function deltaSign(v: number): string {
  if (v > 0) return `+${formatEerr(v)}`;
  if (v < 0) return formatEerr(v);
  return "â€”";
}

function deltaPct(actual: number, anterior: number): string {
  if (anterior === 0) return "â€”";
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
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
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <MetricTooltip metricId={metricId} />
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-800">
        {value !== null ? `${formatEerr(value, 1)}${suffix}` : "â€”"}
      </p>
      {subLabel && <p className="mt-0.5 text-xs text-slate-400">{subLabel}</p>}
      {delta !== null && anterior !== undefined && (
        <p className={`mt-1 text-xs font-medium ${deltaCls(delta)}`}>
          {deltaSign(delta)} ({deltaPct(value!, anterior)}) vs año anterior
        </p>
      )}
    </div>
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

export function FinanceDashboardClient({ selectedProjectId }: Props): JSX.Element {
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
      const res = await fetch(`/api/finance/dashboard?${params}`);
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
    mes: m.slice(5), // MM
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

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Dashboard Financiero"
        description="Resumen ejecutivo del proyecto por periodo."
        actions={
          <div className="flex items-center gap-3">
            {/* Modo */}
            <div className="flex overflow-hidden rounded border border-slate-200 text-xs font-medium">
              {(["mes", "año", "ltm"] as Modo[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModoChange(m)}
                  className={`px-3 py-1.5 uppercase ${modo === m ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
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
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            actionHref="/finance/upload"
            actionLabel="Cargar datos contables"
          />
        </ModuleSectionCard>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
              subLabel={data.kpis.ebitda.margenPct !== null ? `Mg ${data.kpis.ebitda.margenPct.toFixed(1)}%` : undefined}
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
            <KpiCard
              metricId="kpi_dashboard_uf_por_m2"
              label="UF / mÂ²"
              value={data.kpis.ufPorm2}
              subLabel="Ingresos / GLA total"
            />
            <KpiCard
              metricId="kpi_dashboard_vacancia_pct"
              label="Vacancia"
              value={data.kpis.vacanciaPct}
              suffix="%"
              subLabel={`${data.kpis.localesOcupados}/${data.kpis.totalLocalesGLA} locales GLA`}
            />
          </div>

          {/* Gráfico mensual */}
          <MetricChartCard
            title="Evolucion mensual"
            metricId="chart_dashboard_ingresos_ebitda_uf"
            description="Ingresos y EBITDA (UF) con comparativo del ano anterior."
          >
            <ResponsiveContainer width="100%" height={chartHeight.md}>
              <ComposedChart data={chartData} margin={chartMargins.default}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="mes" {...chartAxisProps} />
                <YAxis {...chartAxisProps} tickFormatter={(v: number) => v.toLocaleString("es-CL")} />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => `Mes: ${String(l)}`}
                      valueFormatter={(value) =>
                        typeof value === "number"
                          ? value.toLocaleString("es-CL", { maximumFractionDigits: 0 })
                          : String(value ?? "—")
                      }
                    />
                  }
                />
                <Legend {...chartLegendProps} />
                <Bar dataKey="ingresosActual" name="Ingresos año actual" fill={chartColors.brandPrimary} radius={chartBarRadius} />
                <Bar dataKey="ebitda" name="EBITDA año actual" fill={chartColors.positive} radius={chartBarRadius} />
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                EE.RR Resumen â€” actual vs año anterior (UF)
              </p>
              }
            >
              <table className={`${compactTableTheme.table} text-xs`}>
                <thead className={compactTableTheme.head}>
                  <tr>
                    <th className={compactTableTheme.compactHeadCell}>Sección</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>Actual</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>Año anterior</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>Î” UF</th>
                    <th className={`${compactTableTheme.compactHeadCell} text-right`}>Î” %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {seccionesOrdenadas.map((s, i) => {
                    const isBelowEbitda = BELOW_EBITDA_GROUPS.has(s.grupo1);
                    const delta = s.actual - s.anterior;
                    return (
                      <tr key={s.grupo1} className={`${getStripedRowClass(i, "compact")} ${compactTableTheme.rowHover}`}>
                        <td className={`py-2 pl-4 pr-3 font-medium ${isBelowEbitda ? "text-slate-400" : "text-slate-700"}`}>
                          {s.grupo1}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatEerr(s.actual)}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{formatEerr(s.anterior)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${deltaCls(delta)}`}>{deltaSign(delta)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${deltaCls(delta)}`}>{deltaPct(s.actual, s.anterior)}</td>
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



