"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { Button } from "@/components/ui/button";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import { cn, formatUf, formatUfPerM2 } from "@/lib/utils";
import type { BudgetedSalesMatrixResponse } from "@/types/rent-roll";

type BudgetedSalesMatrixClientProps = {
  selectedProjectId: string;
  desde: string;
  hasta: string;
  data: BudgetedSalesMatrixResponse;
};

type ViewMode = "uf" | "ufm2";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatPeriodShort(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}

function formatCell(value: number | null, mode: ViewMode, glam2: number): string {
  if (value === null) return "—";
  if (mode === "ufm2") {
    if (glam2 <= 0) return "—";
    return formatUfPerM2(value / glam2);
  }
  return formatUf(value);
}

export function BudgetedSalesMatrixClient({
  selectedProjectId,
  desde,
  hasta,
  data,
}: BudgetedSalesMatrixClientProps): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<ViewMode>("uf");
  const [localDesde, setLocalDesde] = useState(desde);
  const [localHasta, setLocalHasta] = useState(hasta);

  const applyRange = (nextDesde: string, nextHasta: string) => {
    setLocalDesde(nextDesde);
    setLocalHasta(nextHasta);
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    if (nextDesde) params.set("desde", nextDesde);
    if (nextHasta) params.set("hasta", nextHasta);
    startTransition(() => {
      router.replace(`/rent-roll/ventas-presupuestadas?${params.toString()}`);
    });
  };

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of data.periods) totals[p] = 0;
    for (const row of data.rows) {
      for (const p of data.periods) {
        const v = row.byPeriod[p];
        if (v !== null && v !== undefined) totals[p] += v;
      }
    }
    return totals;
  }, [data]);

  const hasRows = data.rows.length > 0;

  return (
    <main className={cn("space-y-4", isPending && "opacity-60")}>
      <ModuleHeader
        title="Ventas Presupuestadas por Arrendatario"
        description="Matriz mensual de ventas presupuestadas cargadas por arrendatario. Use el toggle para ver UF totales o UF/m²."
        actions={
          <ProjectPeriodToolbar
            desde={localDesde}
            hasta={localHasta}
            onDesdeChange={(value) => applyRange(value, localHasta)}
            onHastaChange={(value) => applyRange(localDesde, value)}
          />
        }
      />

      {!hasRows ? (
        <ModuleSectionCard>
          <ModuleEmptyState
            message="Sin ventas presupuestadas cargadas para el rango seleccionado."
            actionHref="/finance/upload"
            actionLabel="Cargar ventas presupuestadas"
          />
        </ModuleSectionCard>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              title="Presupuesto total (UF)"
              value={formatUf(data.summary.totalBudgetUf)}
              subtitle={`${data.periods.length} meses en rango`}
              accent="slate"
            />
            <KpiCard
              title="Arrendatarios con datos"
              value={data.summary.tenantsWithData}
              subtitle={
                data.summary.tenantsWithData > 0
                  ? `${data.periods.length * data.summary.tenantsWithData} celdas posibles`
                  : "—"
              }
              accent="green"
            />
            <KpiCard
              title="Con meses faltantes"
              value={data.summary.tenantsWithMissing}
              subtitle={
                data.summary.tenantsWithMissing > 0
                  ? "Revisar carga de ventas presupuestadas"
                  : "Todos los meses cargados"
              }
              accent={data.summary.tenantsWithMissing > 0 ? "yellow" : "green"}
            />
          </section>

          <ModuleSectionCard
            title="Desglose mensual"
            headerAction={
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                <Button
                  type="button"
                  variant={mode === "uf" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("uf")}
                  className="rounded-none"
                >
                  UF
                </Button>
                <Button
                  type="button"
                  variant={mode === "ufm2" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("ufm2")}
                  className="rounded-none"
                >
                  UF/m²
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className={tableTheme.table}>
                <thead className={tableTheme.head}>
                  <tr>
                    <th className={cn(tableTheme.headCell, "sticky left-0 z-10 bg-brand-700")}>
                      Arrendatario
                    </th>
                    <th className={cn(tableTheme.compactHeadCell, "text-right")}>GLA (m²)</th>
                    {data.periods.map((p) => (
                      <th key={p} className={cn(tableTheme.compactHeadCell, "text-right")}>
                        {formatPeriodShort(p)}
                      </th>
                    ))}
                    <th className={cn(tableTheme.compactHeadCell, "text-right")}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row, index) => (
                    <tr
                      key={row.tenantId}
                      className={cn(getStripedRowClass(index), tableTheme.rowHover)}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{row.nombreComercial}</span>
                          {row.missingPeriods.length > 0 && (
                            <span
                              className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                              title={`Sin datos en: ${row.missingPeriods.join(", ")}`}
                            >
                              {row.missingPeriods.length} sin datos
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{row.rut}</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {row.glam2 > 0 ? formatUf(row.glam2, 1) : "—"}
                      </td>
                      {data.periods.map((p) => {
                        const value = row.byPeriod[p];
                        const isMissing = value === null || value === undefined;
                        return (
                          <td
                            key={p}
                            className={cn(
                              "px-3 py-3 text-right tabular-nums",
                              isMissing ? "text-slate-300" : "text-slate-700",
                            )}
                          >
                            {formatCell(value ?? null, mode, row.glam2)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">
                        {mode === "ufm2"
                          ? row.glam2 > 0
                            ? formatUfPerM2(row.total / row.glam2)
                            : "—"
                          : formatUf(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                  <tr>
                    <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                      Total
                    </td>
                    <td className="px-3 py-3" />
                    {data.periods.map((p) => (
                      <td
                        key={p}
                        className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800"
                      >
                        {mode === "uf" ? formatUf(columnTotals[p] ?? 0) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {mode === "uf" ? formatUf(data.summary.totalBudgetUf) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}
