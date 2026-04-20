"use client";

import { useCallback, useEffect, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import { cn, formatPercent, formatUf, formatUfPerM2 } from "@/lib/utils";
import type { CostoOcupacionResponse, CostoOcupacionRow } from "@/types/costo-ocupacion";

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

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  selectedProjectId: string;
  defaultPeriod?: string;
};

export function CostoOcupacionClient({
  selectedProjectId,
  defaultPeriod
}: Props): JSX.Element {
  const [period, setPeriod] = useState(defaultPeriod ?? getCurrentYearMonth());
  const [data, setData] = useState<CostoOcupacionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(period)) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        period
      });
      const res = await fetch(`/api/finance/costo-ocupacion?${params}`);
      if (res.ok) {
        setData((await res.json()) as CostoOcupacionResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, period]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const rows = data?.rows ?? [];

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

      {/* Content */}
      {loading ? (
        <ModuleLoadingState message="Cargando costo de ocupacion..." />
      ) : !data || rows.length === 0 ? (
        <ModuleEmptyState
          message="Sin datos de costo de ocupacion para el periodo seleccionado."
          actionHref="/finance/upload"
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
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Fact. UF/m&sup2;</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Ventas UF/m&sup2;</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Costo Ocup. %</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Fact. YTD</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Ventas YTD</th>
                    <th className={`${compactTheme.compactHeadCell} text-right`}>Costo YTD %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row: CostoOcupacionRow, idx: number) => (
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
                      <td className="px-2 py-1.5 text-right text-slate-600">
                        {formatUf(row.glaM2, 0)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-700">
                        {formatUfPerM2(row.facturacionUfM2)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-700">
                        {formatUfPerM2(row.ventasUfM2)}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right", costColorCls(row.costoOcupacionPct))}>
                        {formatPctOrDash(row.costoOcupacionPct)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-700">
                        {formatUfPerM2(row.facturacionYtdUfM2)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-700">
                        {formatUfPerM2(row.ventasYtdUfM2)}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right", costColorCls(row.costoOcupacionYtdPct))}>
                        {formatPctOrDash(row.costoOcupacionYtdPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </UnifiedTable>
        </ModuleSectionCard>
      )}
    </main>
  );
}
