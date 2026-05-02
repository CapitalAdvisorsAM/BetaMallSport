"use client";

import { useCallback, useEffect, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { DeltaPill } from "@/components/ui/DeltaPill";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import { cn, formatUf, formatUfPerM2 } from "@/lib/utils";
import type { TopTenantsResponse } from "@/types/sales-analytics";

const compactTheme = getTableTheme("compact");

type Props = {
  selectedProjectId: string;
  desde: string;
  hasta: string;
};

function formatCostoPct(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function costoToneClass(value: number | null): string {
  if (value === null) return "text-slate-400";
  if (value > 20) return "text-rose-700 font-semibold";
  if (value > 10) return "text-amber-700";
  return "text-emerald-700";
}

export function VentasTopTenantsTab({
  selectedProjectId,
  desde,
  hasta
}: Props): JSX.Element {
  const [data, setData] = useState<TopTenantsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        limit: "10"
      });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/sales-top-tenants?${params}`);
      if (res.ok) {
        setData((await res.json()) as TopTenantsResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) return <ModuleLoadingState message="Calculando ranking..." />;
  if (!data || data.rows.length === 0) {
    return <ModuleEmptyState message="Sin tenants con ventas en el rango seleccionado." />;
  }

  return (
    <ModuleSectionCard>
      <UnifiedTable
        density="compact"
        toolbar={
          <p className="text-xs text-slate-400">
            Top {data.rows.length} tenants por Ventas UF · Costo Ocupación % calculado YTD del año seleccionado
          </p>
        }
      >
        <table className={`${compactTheme.table} text-xs`}>
          <thead className={compactTheme.head}>
            <tr>
              <th className={`${compactTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3 text-left`}>
                #
              </th>
              <th className={`${compactTheme.headCell} text-left`}>Tenant</th>
              <th className={`${compactTheme.compactHeadCell} text-right`}>Ventas UF</th>
              <th className={`${compactTheme.compactHeadCell} text-right`}>GLA m²</th>
              <th className={`${compactTheme.compactHeadCell} text-right`}>UF/m²</th>
              <th className={`${compactTheme.compactHeadCell} text-right`}>YoY %</th>
              <th className={`${compactTheme.compactHeadCell} text-right`}>%CO YTD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((row, idx) => (
              <tr
                key={row.tenantId}
                className={`${getStripedRowClass(idx, "compact")} ${compactTheme.rowHover}`}
              >
                <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3 font-mono text-slate-500">
                  {idx + 1}
                </td>
                <td className="py-1.5 pr-3 font-medium text-slate-800">{row.nombreComercial}</td>
                <td className="px-2 py-1.5 text-right text-slate-800">
                  {formatUf(row.ventasUf, 0)}
                </td>
                <td className="px-2 py-1.5 text-right text-slate-600">
                  {row.glaM2.toLocaleString("es-CL", { maximumFractionDigits: 0 })}
                </td>
                <td className="px-2 py-1.5 text-right text-slate-800">
                  {formatUfPerM2(row.ufPerM2)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <DeltaPill value={row.yoyPct} kind="ingreso" mode="variance" />
                </td>
                <td className={cn("px-2 py-1.5 text-right", costoToneClass(row.costoOcupacionPct))}>
                  {formatCostoPct(row.costoOcupacionPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </UnifiedTable>
    </ModuleSectionCard>
  );
}
