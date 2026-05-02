"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { MetricChartCard } from "@/components/dashboard/MetricChartCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import { chartAxisProps, chartGridProps, chartHeight, chartMargins, chartColors } from "@/lib/charts/theme";
import { formatUf, formatUfPerM2, getCurrentYearMonth } from "@/lib/utils";
import type { DailyDimensionRow, VentasDiariasResponse } from "@/types/sales-daily";

const compactTheme = getTableTheme("compact");

type DimensionTab = "total" | "tamano" | "tipo" | "piso" | "tiendas";

const TAB_LABELS: Record<DimensionTab, string> = {
  total: "Total",
  tamano: "Tamaño",
  tipo: "Categoría",
  piso: "Piso",
  tiendas: "Tiendas"
};


type Props = {
  selectedProjectId: string;
  defaultPeriod?: string;
};

export function VentasDiariasClient({
  selectedProjectId,
  defaultPeriod
}: Props): JSX.Element {
  const [period, setPeriod] = useState(defaultPeriod ?? getCurrentYearMonth());
  const [data, setData] = useState<VentasDiariasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<DimensionTab>("total");

  const fetchData = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(period)) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId, period });
      const res = await fetch(`/api/real/sales-daily?${params}`);
      if (res.ok) {
        setData((await res.json()) as VentasDiariasResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const rows: DailyDimensionRow[] = !data
    ? []
    : tab === "total"
      ? [data.total]
      : tab === "tamano"
        ? data.byTamano
        : tab === "tipo"
          ? data.byTipo
          : tab === "tiendas"
            ? data.byStore
            : data.byPiso;

  const days = data?.daysInMonth ?? 31;

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Ventas Diarias"
        description="UF y UF/m² por día. Replica la pestaña 'Ventas Diarias' del CDG."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              {(Object.keys(TAB_LABELS) as DimensionTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={
                    tab === key
                      ? "rounded-md bg-brand-500 px-2 py-1 text-white"
                      : "rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50"
                  }
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>
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

      {/* chart20 — Ventas Diarias (UF) */}
      {!loading && data && data.total.values.length > 0 && (
        <MetricChartCard
          title={`Ventas Diarias ${data.period} (UF)`}
          metricId="chart_ventas_diarias_bar"
          description="Venta total diaria en UF para el período seleccionado."
        >
          <ResponsiveContainer width="100%" height={chartHeight.md}>
            <ComposedChart
              data={data.total.values.map((v) => ({ dia: v.day, "Ventas UF": v.uf }))}
              margin={chartMargins.default}
            >
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="dia" {...chartAxisProps} tickFormatter={(v: number) => String(v)} />
              <YAxis {...chartAxisProps} tickFormatter={(v: number) => formatUf(v, 0)} />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => `Día ${String(l)}`}
                    valueFormatter={(v) => formatUf(typeof v === "number" ? v : Number(v ?? 0))}
                  />
                }
              />
              <Bar dataKey="Ventas UF" name="Ventas UF" fill={chartColors.brandPrimary} maxBarSize={14} />
            </ComposedChart>
          </ResponsiveContainer>
        </MetricChartCard>
      )}

      {loading ? (
        <ModuleLoadingState message="Cargando ventas diarias..." />
      ) : !data || rows.length === 0 ? (
        <ModuleEmptyState
          message="Sin ventas diarias para el periodo seleccionado."
          actionHref="/imports"
          actionLabel="Cargar Data Ventas (diaria)"
        />
      ) : (
        <ModuleSectionCard>
          <UnifiedTable
            density="compact"
            toolbar={
              <p className="text-xs text-slate-400">
                Periodo: {data.period} · {days} días · {rows.length}{" "}
                {tab === "total" ? "" : "filas"}
              </p>
            }
          >
            <div className="overflow-x-auto">
              {tab === "tiendas" ? (
                <DailyMatrix rows={rows} days={days} kind="uf" />
              ) : (
                <>
                  <DailyMatrix rows={rows} days={days} kind="uf" />
                  <DailyMatrix rows={rows} days={days} kind="ufM2" className="mt-6" />
                </>
              )}
            </div>
          </UnifiedTable>
        </ModuleSectionCard>
      )}
    </main>
  );
}

function DailyMatrix({
  rows,
  days,
  kind,
  className
}: {
  rows: DailyDimensionRow[];
  days: number;
  kind: "uf" | "ufM2";
  className?: string;
}): JSX.Element {
  const dayList = Array.from({ length: days }, (_, i) => i + 1);
  const fmt = (v: number): string => (kind === "uf" ? formatUf(v, 0) : formatUfPerM2(v));
  return (
    <div className={className ?? ""}>
      <p className="mb-1 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {kind === "uf" ? "UF" : "UF/m²"}
      </p>
      <table className={`${compactTheme.table} text-xs`}>
        <thead className={compactTheme.head}>
          <tr>
            <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3 min-w-[160px] text-left`}>
              {kind === "uf" ? "UF" : "UF/m²"}
            </th>
            {dayList.map((d) => (
              <th key={d} className={`${compactTheme.compactHeadCell} text-right`}>
                {d}
              </th>
            ))}
            <th className={`${compactTheme.compactHeadCell} text-right font-semibold`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, idx) => (
            <tr
              key={row.label}
              className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}
            >
              <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-medium text-slate-700">
                {row.label}
              </td>
              {row.values.map((cell) => (
                <td key={cell.day} className="px-2 py-1.5 text-right text-slate-700 num">
                  {fmt(kind === "uf" ? cell.uf : cell.ufM2)}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right font-semibold text-slate-800 num">
                {fmt(kind === "uf" ? row.totalUf : row.totalUfM2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
