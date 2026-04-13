"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import { type GapSeverity, getGapSeverity } from "@/lib/shared/gap-utils";
import { formatUf, cn } from "@/lib/utils";
import type { ProjectOption } from "@/types/finance";

type ReconciliationRow = {
  tenantId: string;
  rut: string;
  nombreComercial: string;
  locales: { codigo: string; nombre: string }[];
  glam2: number;
  expectedUf: number;
  expectedGgccUf: number;
  actualUf: number;
  actualGgccUf: number;
  gapUf: number;
  gapPct: number;
  gapGgccUf: number;
  gapGgccPct: number;
};

type ReconciliationSummary = {
  totalExpectedUf: number;
  totalActualUf: number;
  totalGapUf: number;
  totalGapPct: number;
  totalExpectedGgccUf: number;
  totalActualGgccUf: number;
  totalGapGgccUf: number;
  totalGapGgccPct: number;
  tenantsWithGapOver5: number;
  tenantsWithGapOver10: number;
  tenantCount: number;
};

type ReconciliationResponse = {
  rows: ReconciliationRow[];
  summary: ReconciliationSummary;
  periods: string[];
};

type ReconciliationClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

type GapFilter = "all" | "over5" | "over10" | "overbilled";

const gapBadgeStyles: Record<GapSeverity, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700"
};

const gapTextStyles: Record<GapSeverity, string> = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700 font-semibold"
};

function GapBadge({ pct }: { pct: number }): JSX.Element {
  const severity = getGapSeverity(pct);
  const label = pct > 0 ? "Sub-facturado" : pct < 0 ? "Sobre-facturado" : "OK";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", gapBadgeStyles[severity])}>
      {label}
    </span>
  );
}

export function ReconciliationClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: ReconciliationClientProps): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [gapFilter, setGapFilter] = useState<GapFilter>("all");
  const [activeTab, setActiveTab] = useState<"general" | "ggcc">("general");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const response = await fetch(`/api/finance/reconciliation?${params.toString()}`);
      const payload = (await response.json()) as ReconciliationResponse;
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((row) => {
      switch (gapFilter) {
        case "over5": return Math.abs(row.gapPct) >= 5;
        case "over10": return Math.abs(row.gapPct) >= 10;
        case "overbilled": return row.gapUf < 0;
        default: return true;
      }
    });
  }, [data, gapFilter]);

  const summary = data?.summary;

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Reconciliacion"
        description="Facturacion esperada (contratos) vs facturacion real (contabilidad) por arrendatario."
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

      {loading ? (
        <ModuleLoadingState />
      ) : !data || data.rows.length === 0 ? (
        <ModuleSectionCard>
          <ModuleEmptyState
            message="Sin datos de reconciliacion para el periodo seleccionado. Asegurate de haber cargado datos contables."
            actionHref={`/finance/upload?project=${selectedProjectId}`}
            actionLabel="Cargar datos contables"
          />
        </ModuleSectionCard>
      ) : (
        <>
          {/* KPI Row */}
          {summary && (
            <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                metricId="kpi_rent_roll_snapshot_facturacion_esperada_vs_real"
                title="Esperado total (UF)"
                value={formatUf(summary.totalExpectedUf)}
                accent="slate"
              />
              <KpiCard
                metricId="kpi_rent_roll_snapshot_facturacion_esperada_vs_real"
                title="Facturado real (UF)"
                value={formatUf(summary.totalActualUf)}
                accent="slate"
              />
              <KpiCard
                metricId="kpi_rent_roll_snapshot_brecha_total"
                title="Brecha total"
                value={`${formatUf(summary.totalGapUf)} UF`}
                subtitle={`${formatUf(summary.totalGapPct, 1)}% del esperado`}
                accent={Math.abs(summary.totalGapPct) >= 10 ? "red" : Math.abs(summary.totalGapPct) >= 2 ? "yellow" : "green"}
              />
              <KpiCard
                metricId="kpi_rent_roll_snapshot_brecha_total"
                title="Arrendatarios gap >5%"
                value={`${summary.tenantsWithGapOver5} de ${summary.tenantCount}`}
                accent={summary.tenantsWithGapOver5 > 0 ? "yellow" : "green"}
              />
              <KpiCard
                metricId="kpi_rent_roll_snapshot_brecha_total"
                title="Arrendatarios gap >10%"
                value={`${summary.tenantsWithGapOver10} de ${summary.tenantCount}`}
                accent={summary.tenantsWithGapOver10 > 0 ? "red" : "green"}
              />
            </section>
          )}

          {/* Tab + Filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-3 shadow-sm">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("general")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === "general" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab("ggcc")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === "ggcc" ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                GGCC
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Filtrar:</span>
              <select
                value={gapFilter}
                onChange={(e) => setGapFilter(e.target.value as GapFilter)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
              >
                <option value="all">Todos</option>
                <option value="over5">Brecha &gt;5%</option>
                <option value="over10">Brecha &gt;10%</option>
                <option value="overbilled">Sobre-facturado</option>
              </select>
              <span className="text-xs text-slate-400">{filteredRows.length} arrendatarios</span>
            </div>
          </div>

          {/* Table */}
          <ModuleSectionCard>
            <div className="overflow-x-auto">
              <table className={tableTheme.table}>
                <thead className={tableTheme.head}>
                  <tr>
                    <th className={`${tableTheme.headCell} sticky left-0 bg-brand-700`}>
                      Arrendatario
                    </th>
                    <th className={tableTheme.compactHeadCell}>Locales</th>
                    <th className={`${tableTheme.compactHeadCell} text-right`}>GLA (m²)</th>
                    {activeTab === "general" ? (
                      <>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>Esperado (UF)</th>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>Real (UF)</th>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>Brecha (UF)</th>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>Brecha %</th>
                      </>
                    ) : (
                      <>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>GGCC Esperado (UF)</th>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>GGCC Real (UF)</th>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>Brecha GGCC (UF)</th>
                        <th className={`${tableTheme.compactHeadCell} text-right`}>Brecha GGCC %</th>
                      </>
                    )}
                    <th className={`${tableTheme.compactHeadCell} text-center`}>Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row, index) => {
                    const isGeneral = activeTab === "general";
                    const gap = isGeneral ? row.gapUf : row.gapGgccUf;
                    const gapPct = isGeneral ? row.gapPct : row.gapGgccPct;
                    const expected = isGeneral ? row.expectedUf : row.expectedGgccUf;
                    const actual = isGeneral ? row.actualUf : row.actualGgccUf;
                    const severity = getGapSeverity(gapPct);

                    return (
                      <tr key={row.tenantId} className={`${getStripedRowClass(index)} ${tableTheme.rowHover}`}>
                        <td className="sticky left-0 bg-inherit px-4 py-3 font-medium text-slate-800">
                          <Link
                            href={`/tenants/${row.tenantId}?project=${selectedProjectId}`}
                            className="text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
                          >
                            {row.nombreComercial}
                          </Link>
                          <p className="text-xs text-slate-400">{row.rut}</p>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-500">
                          {row.locales.map((l) => l.codigo).join(", ")}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {formatUf(row.glam2, 1)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {formatUf(expected)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {formatUf(actual)}
                        </td>
                        <td className={cn("px-3 py-3 text-right tabular-nums", gapTextStyles[severity])}>
                          {formatUf(gap)}
                        </td>
                        <td className={cn("px-3 py-3 text-right tabular-nums", gapTextStyles[severity])}>
                          {formatUf(gapPct, 1)}%
                        </td>
                        <td className="px-3 py-3 text-center">
                          <GapBadge pct={gapPct} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Summary row */}
                {summary && filteredRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-brand-700 bg-slate-50 font-semibold text-slate-800">
                      <td className="sticky left-0 bg-slate-50 px-4 py-3">
                        Totales ({filteredRows.length} arrendatarios)
                      </td>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatUf(filteredRows.reduce((a, r) => a + r.glam2, 0), 1)}
                      </td>
                      {activeTab === "general" ? (
                        <>
                          <td className="px-3 py-3 text-right tabular-nums">{formatUf(filteredRows.reduce((a, r) => a + r.expectedUf, 0))}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatUf(filteredRows.reduce((a, r) => a + r.actualUf, 0))}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatUf(filteredRows.reduce((a, r) => a + r.gapUf, 0))}</td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {(() => {
                              const totalExp = filteredRows.reduce((a, r) => a + r.expectedUf, 0);
                              const totalGap = filteredRows.reduce((a, r) => a + r.gapUf, 0);
                              return totalExp > 0 ? `${formatUf((totalGap / totalExp) * 100, 1)}%` : "–";
                            })()}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 text-right tabular-nums">{formatUf(filteredRows.reduce((a, r) => a + r.expectedGgccUf, 0))}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatUf(filteredRows.reduce((a, r) => a + r.actualGgccUf, 0))}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatUf(filteredRows.reduce((a, r) => a + r.gapGgccUf, 0))}</td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {(() => {
                              const totalExp = filteredRows.reduce((a, r) => a + r.expectedGgccUf, 0);
                              const totalGap = filteredRows.reduce((a, r) => a + r.gapGgccUf, 0);
                              return totalExp > 0 ? `${formatUf((totalGap / totalExp) * 100, 1)}%` : "–";
                            })()}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}
