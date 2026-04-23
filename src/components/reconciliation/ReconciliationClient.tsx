"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { DataTable } from "@/components/ui/DataTable";
import { TableCell, TableRow } from "@/components/ui/table";
import { useDataTable } from "@/hooks/useDataTable";
import { type GapSeverity, getGapSeverity } from "@/lib/real/gap-utils";
import { formatUf, cn } from "@/lib/utils";

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
  missingSalesPeriods: string[];
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
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

type GapFilter = "all" | "over5" | "over10" | "overbilled";
type ActiveTab = "general" | "ggcc";

const gapBadgeStyles: Record<GapSeverity, string> = {
  ok: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
};

const gapTextStyles: Record<GapSeverity, string> = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700 font-semibold",
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
  selectedProjectId,
  defaultDesde,
  defaultHasta,
}: ReconciliationClientProps): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [gapFilter, setGapFilter] = useState<GapFilter>("all");
  const [activeTab, setActiveTab] = useState<ActiveTab>("general");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const response = await fetch(`/api/real/reconciliation?${params.toString()}`);
      const payload = (await response.json()) as ReconciliationResponse;
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Gap filter applied before TanStack (custom multi-condition)
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

  // Columns depend on active tab — useMemo so the reference is stable per tab
  const columns = useMemo<ColumnDef<ReconciliationRow, unknown>[]>(() => {
    const isGeneral = activeTab === "general";
    return [
      {
        id: "nombreComercial",
        accessorKey: "nombreComercial",
        header: "Arrendatario",
        filterFn: "includesString",
        meta: { filterType: "text", sticky: true },
        cell: ({ row }: CellContext<ReconciliationRow, unknown>) => (
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/tenants/${row.original.tenantId}`}
                className="font-medium text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
              >
                {row.original.nombreComercial}
              </Link>
              {row.original.missingSalesPeriods.length > 0 && (
                <span
                  className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                  title={`Sin ventas en ${row.original.missingSalesPeriods.length} periodo(s): ${row.original.missingSalesPeriods.join(", ")}`}
                >
                  Sin ventas ({row.original.missingSalesPeriods.length})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{row.original.rut}</p>
          </div>
        ),
      },
      {
        id: "locales",
        header: "Locales",
        accessorFn: (row: ReconciliationRow) => row.locales.map((l) => l.codigo).join(", "),
        meta: { filterType: "string" },
      },
      {
        id: "glam2",
        accessorKey: "glam2",
        header: "GLA (m²)",
        meta: {
          align: "right",
          isNumeric: true,
          summary: { type: "sum" as const, formatter: (v: number) => formatUf(v, 1) },
        },
        cell: ({ getValue }: CellContext<ReconciliationRow, unknown>) => formatUf(getValue() as number, 1),
      },
      // General columns
      {
        id: "expectedUf",
        accessorKey: "expectedUf",
        header: "Esperado (UF)",
        meta: {
          align: "right",
          isNumeric: true,
          summary: { type: "sum" as const, formatter: (v: number) => formatUf(v) },
        },
        cell: ({ getValue }: CellContext<ReconciliationRow, unknown>) => formatUf(getValue() as number),
      },
      {
        id: "actualUf",
        accessorKey: "actualUf",
        header: "Real (UF)",
        meta: {
          align: "right",
          isNumeric: true,
          summary: { type: "sum" as const, formatter: (v: number) => formatUf(v) },
        },
        cell: ({ getValue }: CellContext<ReconciliationRow, unknown>) => formatUf(getValue() as number),
      },
      {
        id: "gapUf",
        accessorKey: "gapUf",
        header: "Brecha (UF)",
        meta: {
          align: "right",
          isNumeric: true,
          filterType: "number" as const,
          summary: { type: "sum" as const, formatter: (v: number) => formatUf(v) },
        },
        cell: ({ row }: CellContext<ReconciliationRow, unknown>) => {
          const severity = getGapSeverity(row.original.gapPct);
          return <span className={gapTextStyles[severity]}>{formatUf(row.original.gapUf)}</span>;
        },
      },
      {
        id: "gapPct",
        accessorKey: "gapPct",
        header: "Brecha %",
        meta: { align: "right", isNumeric: true, filterType: "number" as const },
        cell: ({ row }: CellContext<ReconciliationRow, unknown>) => {
          const severity = getGapSeverity(row.original.gapPct);
          return <span className={gapTextStyles[severity]}>{formatUf(row.original.gapPct, 1)}%</span>;
        },
      },
      // GGCC columns
      {
        id: "expectedGgccUf",
        accessorKey: "expectedGgccUf",
        header: "GGCC Esperado (UF)",
        meta: {
          align: "right",
          isNumeric: true,
          summary: { type: "sum" as const, formatter: (v: number) => formatUf(v) },
        },
        cell: ({ getValue }: CellContext<ReconciliationRow, unknown>) => formatUf(getValue() as number),
      },
      {
        id: "actualGgccUf",
        accessorKey: "actualGgccUf",
        header: "GGCC Real (UF)",
        meta: {
          align: "right",
          isNumeric: true,
          summary: { type: "sum" as const, formatter: (v: number) => formatUf(v) },
        },
        cell: ({ getValue }: CellContext<ReconciliationRow, unknown>) => formatUf(getValue() as number),
      },
      {
        id: "gapGgccUf",
        accessorKey: "gapGgccUf",
        header: "Brecha GGCC (UF)",
        meta: {
          align: "right",
          isNumeric: true,
          filterType: "number" as const,
          summary: { type: "sum" as const, formatter: (v: number) => formatUf(v) },
        },
        cell: ({ row }: CellContext<ReconciliationRow, unknown>) => {
          const severity = getGapSeverity(row.original.gapGgccPct);
          return <span className={gapTextStyles[severity]}>{formatUf(row.original.gapGgccUf)}</span>;
        },
      },
      {
        id: "gapGgccPct",
        accessorKey: "gapGgccPct",
        header: "Brecha GGCC %",
        meta: { align: "right", isNumeric: true, filterType: "number" as const },
        cell: ({ row }: CellContext<ReconciliationRow, unknown>) => {
          const severity = getGapSeverity(row.original.gapGgccPct);
          return <span className={gapTextStyles[severity]}>{formatUf(row.original.gapGgccPct, 1)}%</span>;
        },
      },
      // Status badge — always last; references the active tab's gap
      {
        id: "estado",
        header: "Estado",
        meta: { align: "center" },
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }: CellContext<ReconciliationRow, unknown>) => (
          <GapBadge pct={isGeneral ? row.original.gapPct : row.original.gapGgccPct} />
        ),
      },
    ].filter((col) => {
      // Show only the columns relevant to the active tab
      const generalOnly = new Set(["expectedUf", "actualUf", "gapUf", "gapPct"]);
      const ggccOnly = new Set(["expectedGgccUf", "actualGgccUf", "gapGgccUf", "gapGgccPct"]);
      if (isGeneral && ggccOnly.has(col.id ?? "")) return false;
      if (!isGeneral && generalOnly.has(col.id ?? "")) return false;
      return true;
    }) as ColumnDef<ReconciliationRow, unknown>[];
  }, [activeTab]);

  const { table } = useDataTable(filteredRows, columns);
  const summary = data?.summary;

  // Computed footer totals for the visible tab
  const footerContent = useMemo(() => {
    if (!summary || filteredRows.length === 0) return undefined;
    const isGeneral = activeTab === "general";

    const totalGla = filteredRows.reduce((a, r) => a + r.glam2, 0);
    const totalExpected = filteredRows.reduce((a, r) => a + (isGeneral ? r.expectedUf : r.expectedGgccUf), 0);
    const totalActual = filteredRows.reduce((a, r) => a + (isGeneral ? r.actualUf : r.actualGgccUf), 0);
    const totalGap = filteredRows.reduce((a, r) => a + (isGeneral ? r.gapUf : r.gapGgccUf), 0);
    const totalGapPct = totalExpected > 0 ? (totalGap / totalExpected) * 100 : 0;
    const gapSeverity = getGapSeverity(totalGapPct);

    return (
      <TableRow className="border-t-2 border-brand-700 bg-slate-50 font-semibold text-slate-800 hover:bg-slate-50">
        <TableCell className="sticky left-0 z-10 bg-slate-50 px-4 py-3">
          Totales ({filteredRows.length} arrendatarios)
        </TableCell>
        {/* Locales column — empty */}
        <TableCell className="px-3 py-3" />
        <TableCell className="px-3 py-3 text-right tabular-nums">{formatUf(totalGla, 1)}</TableCell>
        <TableCell className="px-3 py-3 text-right tabular-nums">{formatUf(totalExpected)}</TableCell>
        <TableCell className="px-3 py-3 text-right tabular-nums">{formatUf(totalActual)}</TableCell>
        <TableCell className={cn("px-3 py-3 text-right tabular-nums", gapTextStyles[gapSeverity])}>
          {formatUf(totalGap)}
        </TableCell>
        <TableCell className={cn("px-3 py-3 text-right tabular-nums", gapTextStyles[gapSeverity])}>
          {formatUf(totalGapPct, 1)}%
        </TableCell>
        {/* Estado badge column — empty in footer */}
        <TableCell className="px-3 py-3" />
      </TableRow>
    );
  }, [summary, filteredRows, activeTab]);

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Reconciliación"
        description="Facturación esperada (contratos) vs facturación real (contabilidad) por arrendatario."
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
            message="Sin datos de reconciliación para el periodo seleccionado. Asegúrate de haber cargado datos contables."
            actionHref="/imports"
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
              {(["general", "ggcc"] as ActiveTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === tab ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {tab === "general" ? "General" : "GGCC"}
                </button>
              ))}
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
            <DataTable
              table={table}
              emptyMessage="Sin arrendatarios para los filtros seleccionados."
              footerContent={footerContent}
              density="compact"
            />
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}
