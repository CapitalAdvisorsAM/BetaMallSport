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
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import { cn } from "@/lib/utils";
import type { ProjectOption } from "@/types/finance";
import type { FacturacionResponse } from "@/types/facturacion";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DimensionTab = "tamano" | "tipo" | "piso";

const DIMENSION_LABELS: Record<DimensionTab, string> = {
  tamano: "Categoría (Tamaño)",
  tipo: "Categoría (Tipo)",
  piso: "Piso"
};

const BAR_COLORS = [
  "#1e40af", "#059669", "#d97706", "#7c3aed",
  "#dc2626", "#0891b2", "#84cc16", "#f97316",
  "#6366f1", "#ec4899"
];

const compactTheme = getTableTheme("compact");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUfM2(v: number): string {
  return v.toLocaleString("es-CL", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function valueCls(v: number): string {
  if (v === 0) return "text-slate-300";
  return v < 0 ? "text-red-600" : "text-slate-800";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

export function FacturacionClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [dimension, setDimension] = useState<DimensionTab>("tamano");
  const [breakdown, setBreakdown] = useState(false);

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
      const res = await fetch(`/api/finance/facturacion?${params}`);
      if (res.ok) {
        setData((await res.json()) as FacturacionResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dimension, breakdown, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const periods = data?.periods ?? [];
  const series = data?.series ?? [];
  const totals = data?.totals ?? [];
  const dimensionKeys = series.map((s) => s.dimension);

  // Build chart data
  const chartData = periods.map((p, i) => {
    const entry: Record<string, string | number> = { mes: p.slice(5) };
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
        projects={projects}
        selectedProjectId={selectedProjectId}
        preserve={{ desde, hasta }}
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
          actionHref={`/finance/upload?project=${selectedProjectId}`}
          actionLabel="Cargar datos contables"
        />
      ) : (
        <>
          {/* Chart */}
          <MetricChartCard
            title={`Facturación All-In (UF/m²) por ${DIMENSION_LABELS[dimension]}`}
            metricId="chart_finance_occupancy"
            description="Barras: UF/m² por dimensión. Línea: total UF/m²."
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v.toFixed(2)} />
                <Tooltip
                  formatter={(value, name) => {
                    const v = typeof value === "number" ? value : Number(value ?? 0);
                    return [v.toFixed(4), String(name ?? "")];
                  }}
                  labelFormatter={(l) => `Mes: ${String(l)}`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {dimensionKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={key}
                    fill={BAR_COLORS[i % BAR_COLORS.length]}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="Total UF/m²"
                  name="Total UF/m²"
                  stroke="#94a3b8"
                  strokeDasharray="4 2"
                  dot={false}
                  strokeWidth={1.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </MetricChartCard>

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
              <table className={`${compactTheme.table} text-xs`}>
                <thead className={compactTheme.head}>
                  <tr>
                    <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                      {DIMENSION_LABELS[dimension]}
                    </th>
                    {periods.map((p) => (
                      <th key={p} className={`${compactTheme.compactHeadCell} min-w-[80px] text-right`}>
                        {p}
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
                        <td key={d.period} className={cn("px-2 py-1.5 text-right", valueCls(d.ufPerM2))}>
                          {fmtUfM2(d.ufPerM2)}
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
                      <td key={t.period} className="px-2 py-2 text-right text-xs font-bold">
                        {fmtUfM2(t.ufPerM2)}
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
