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
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { formatEerr, BELOW_EBITDA_GROUPS } from "@/lib/finance/eerr";
import type { MetricFormulaId } from "@/lib/metric-formulas";
import type { ProjectOption } from "@/types/finance";

type Modo = "mes" | "aÃ±o" | "ltm";

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
  projects: ProjectOption[];
  selectedProjectId: string;
};

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
          {deltaSign(delta)} ({deltaPct(value!, anterior)}) vs aÃ±o anterior
        </p>
      )}
    </div>
  );
}

function getModoLabel(modo: Modo, periodo: string): string {
  if (modo === "mes") return `Mes: ${periodo}`;
  if (modo === "aÃ±o") return `AÃ±o: ${periodo}`;
  return `LTM: Ãºltimos 12 meses hasta ${periodo}`;
}

function currentPeriodDefault(modo: Modo): string {
  const now = new Date();
  if (modo === "aÃ±o") return String(now.getFullYear());
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function FinanceDashboardClient({ projects, selectedProjectId }: Props): JSX.Element {
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
      const params = new URLSearchParams({ proyectoId: selectedProjectId, modo, periodo });
      const res = await fetch(`/api/finance/dashboard?${params}`);
      setData((await res.json()) as DashboardData);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, modo, periodo]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const chartData = data?.grafico.meses.map((m, i) => ({
    mes: m.slice(5), // MM
    ingresosActual: data.grafico.ingresosActual[i] ?? 0,
    ingresosAnterior: data.grafico.ingresosAnterior[i] ?? 0,
    ebitda: data.grafico.ebitdaActual[i] ?? 0
  })) ?? [];

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
        projects={projects}
        selectedProjectId={selectedProjectId}
        actions={
          <div className="flex items-center gap-3">
            {/* Modo */}
            <div className="flex overflow-hidden rounded border border-slate-200 text-xs font-medium">
              {(["mes", "aÃ±o", "ltm"] as Modo[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModoChange(m)}
                  className={`px-3 py-1.5 uppercase ${modo === m ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {m === "ltm" ? "LTM" : m === "aÃ±o" ? "AÃ±o" : "Mes"}
                </button>
              ))}
            </div>
            {/* Periodo input */}
            <input
              type={modo === "aÃ±o" ? "number" : "month"}
              value={periodo}
              min={modo === "aÃ±o" ? "2020" : undefined}
              max={modo === "aÃ±o" ? String(new Date().getFullYear()) : undefined}
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
            actionHref={`/finance/upload?project=${selectedProjectId}`}
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

          {/* GrÃ¡fico mensual */}
          <MetricChartCard
            title="Evolucion mensual"
            metricId="chart_dashboard_ingresos_ebitda_uf"
            description="Ingresos y EBITDA (UF) con comparativo del ano anterior."
          >
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v.toLocaleString("es-CL")} />
                <Tooltip
                  formatter={(value) => [
                    typeof value === "number"
                      ? value.toLocaleString("es-CL", { maximumFractionDigits: 0 })
                      : String(value ?? "â€”"),
                    ""
                  ]}
                  labelFormatter={(l) => `Mes: ${String(l)}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ingresosActual" name="Ingresos aÃ±o actual" fill="#1e40af" radius={[2, 2, 0, 0]} />
                <Bar dataKey="ebitda" name="EBITDA aÃ±o actual" fill="#059669" radius={[2, 2, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="ingresosAnterior"
                  name="Ingresos aÃ±o anterior"
                  stroke="#94a3b8"
                  strokeDasharray="4 2"
                  dot={false}
                  strokeWidth={1.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

          {/* Tabla EE.RR resumen */}
          <ModuleSectionCard>
            <div className="mb-3 px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                EE.RR Resumen â€” actual vs aÃ±o anterior (UF)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-700 bg-slate-800 text-white">
                    <th className="py-2 pl-4 pr-3 text-left font-semibold uppercase tracking-wide">SecciÃ³n</th>
                    <th className="px-3 py-2 text-right font-semibold">Actual</th>
                    <th className="px-3 py-2 text-right font-semibold">AÃ±o anterior</th>
                    <th className="px-3 py-2 text-right font-semibold">Î” UF</th>
                    <th className="px-3 py-2 text-right font-semibold">Î” %</th>
                  </tr>
                </thead>
                <tbody>
                  {seccionesOrdenadas.map((s, i) => {
                    const isBelowEbitda = BELOW_EBITDA_GROUPS.has(s.grupo1);
                    const delta = s.actual - s.anterior;
                    return (
                      <tr key={s.grupo1} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
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
            </div>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}



