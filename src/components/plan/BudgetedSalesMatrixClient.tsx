"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
} from "@tanstack/react-table";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { Button } from "@/components/ui/button";
import { ExcelColumnHeader } from "@/components/ui/DataTable";
import { getTableTheme, getStripedRowClass } from "@/components/ui/table-theme";
import { useBudgetedSalesCellApi } from "@/hooks/useBudgetedSalesCellApi";
import { cn, formatClp, formatDecimal } from "@/lib/utils";
import type { BudgetedSalesMatrixResponse, BudgetedSalesMatrixRow } from "@/types/rent-roll";

type BudgetedSalesMatrixClientProps = {
  selectedProjectId: string;
  desde: string;
  hasta: string;
  data: BudgetedSalesMatrixResponse;
  canEdit: boolean;
};

type ViewMode = "pesos" | "pesosm2";

const compactTheme = getTableTheme("compact");

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatPeriodShort(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}

function formatCell(value: number | null, mode: ViewMode, glam2: number): string {
  if (value === null) return "—";
  if (mode === "pesosm2") {
    if (glam2 <= 0) return "—";
    return formatDecimal(value / glam2);
  }
  return formatClp(value);
}

function cellKey(tenantId: string, period: string): string {
  return `${tenantId}__${period}`;
}

// Copied from useDataTable.ts — checklist filter for the Arrendatario column
const inListFilterFn: FilterFn<BudgetedSalesMatrixRow> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  return filterValue.includes(String(row.getValue(columnId) ?? ""));
};
inListFilterFn.autoRemove = (val: unknown) =>
  !Array.isArray(val) || (val as unknown[]).length === 0;

type EditableCellProps = {
  tenantId: string;
  period: string;
  value: number | null;
  glam2: number;
  mode: ViewMode;
  isSaving: boolean;
  onSave: (tenantId: string, period: string, nextRaw: string) => Promise<void>;
};

function EditableCell({
  tenantId,
  period,
  value,
  glam2,
  mode,
  isSaving,
  onSave,
}: EditableCellProps): JSX.Element {
  const initial = value !== null ? String(value) : "";
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);

  if (mode === "pesosm2") {
    return (
      <span className="text-slate-400" title="Cambia a Pesos para editar">
        {formatCell(value, mode, glam2)}
      </span>
    );
  }

  function handleBlur(): void {
    setEditing(false);
    const normalized = draft.trim();
    const normalizedInitial = initial.trim();
    if (normalized === normalizedInitial) return;
    void onSave(tenantId, period, normalized);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(initial);
      requestAnimationFrame(() => event.currentTarget.blur());
    }
  }

  if (!editing) {
    return (
      <span
        className={cn(
          "block w-full cursor-text rounded px-2 py-0.5 text-right tabular-nums",
          "hover:bg-slate-100",
          isSaving ? "opacity-60" : value === null ? "text-slate-300" : "text-slate-700",
        )}
        onClick={() => setEditing(true)}
        role="button"
        tabIndex={0}
        onFocus={() => setEditing(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setEditing(true); }}
      >
        {value === null ? "—" : formatClp(value)}
      </span>
    );
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      step="1"
      min="0"
      autoFocus
      value={draft}
      disabled={isSaving}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        "w-full rounded border border-brand-500 bg-white px-2 py-0.5 text-right tabular-nums text-slate-700",
        "focus:outline-none focus:ring-1 focus:ring-brand-500",
        isSaving && "opacity-60",
      )}
    />
  );
}

export function BudgetedSalesMatrixClient({
  selectedProjectId,
  desde,
  hasta,
  data,
  canEdit,
}: BudgetedSalesMatrixClientProps): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<ViewMode>("pesos");
  const [localDesde, setLocalDesde] = useState(desde);
  const [localHasta, setLocalHasta] = useState(hasta);
  const { saveCell } = useBudgetedSalesCellApi();

  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Refs so cell renderers always see the latest values without recreating columns
  const savingKeysRef = useRef(savingKeys);
  savingKeysRef.current = savingKeys;
  const handleSaveCellRef = useRef<(t: string, p: string, r: string) => Promise<void>>(
    async () => {},
  );

  const applyRange = (nextDesde: string, nextHasta: string) => {
    setLocalDesde(nextDesde);
    setLocalHasta(nextHasta);
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    if (nextDesde) params.set("desde", nextDesde);
    if (nextHasta) params.set("hasta", nextHasta);
    startTransition(() => {
      router.replace(`/plan/budgeted-sales?${params.toString()}`);
    });
  };

  function getCellValue(tenantId: string, period: string, raw: number | null): number | null {
    const key = cellKey(tenantId, period);
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      return overrides[key];
    }
    return raw;
  }

  async function handleSaveCell(
    tenantId: string,
    period: string,
    nextRaw: string,
  ): Promise<void> {
    const key = cellKey(tenantId, period);
    const salesPesos = nextRaw === "" ? null : nextRaw;
    const parsedNumber = salesPesos === null ? null : Number(salesPesos);

    if (salesPesos !== null && (Number.isNaN(parsedNumber) || (parsedNumber ?? 0) < 0)) {
      toast.error("Ingresa un numero valido (>= 0).");
      return;
    }

    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      const response = await saveCell({
        projectId: selectedProjectId,
        tenantId,
        period,
        salesPesos,
      });
      const nextValue = response.salesPesos === null ? null : Number(response.salesPesos);
      setOverrides((prev) => ({ ...prev, [key]: nextValue }));
      toast.success(salesPesos === null ? "Celda borrada." : "Valor guardado.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar.");
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  handleSaveCellRef.current = handleSaveCell;

  const rowsWithOverrides = useMemo(() => {
    return data.rows.map((row) => {
      const byPeriod: Record<string, number | null> = { ...row.byPeriod };
      let total = 0;
      const missingPeriods: string[] = [];
      for (const p of data.periods) {
        const value = getCellValue(row.tenantId, p, row.byPeriod[p] ?? null);
        byPeriod[p] = value;
        if (value === null) {
          missingPeriods.push(p);
        } else {
          total += value;
        }
      }
      return { ...row, byPeriod, total, missingPeriods };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, overrides]);

  const columns = useMemo<ColumnDef<BudgetedSalesMatrixRow>[]>(
    () => [
      {
        id: "nombreComercial",
        accessorKey: "nombreComercial",
        header: "Arrendatario",
        // default filterFn = "inList" → searchable checklist of all tenant names
        meta: { sticky: true },
        cell: ({ row }) => (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{row.original.nombreComercial}</span>
              {row.original.missingPeriods.length > 0 &&
                row.original.missingPeriods.length < data.periods.length && (
                  <span
                    className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                    title={`Sin datos en: ${row.original.missingPeriods.join(", ")}`}
                  >
                    {row.original.missingPeriods.length} sin datos
                  </span>
                )}
            </div>
            <p className="text-[10px] text-slate-400">{row.original.rut}</p>
          </>
        ),
      },
      {
        id: "glam2",
        accessorKey: "glam2",
        header: "GLA (m²)",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => (
          <span className="block text-right tabular-nums text-sm text-slate-700">
            {row.original.glam2 > 0 ? formatDecimal(row.original.glam2) : "—"}
          </span>
        ),
      },
      ...data.periods.map((p): ColumnDef<BudgetedSalesMatrixRow> => ({
        id: p,
        accessorFn: (row) => row.byPeriod[p] ?? null,
        header: formatPeriodShort(p),
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => {
          const value = row.original.byPeriod[p] ?? null;
          const key = cellKey(row.original.tenantId, p);
          return canEdit ? (
            <EditableCell
              tenantId={row.original.tenantId}
              period={p}
              value={value}
              glam2={row.original.glam2}
              mode={mode}
              isSaving={savingKeysRef.current.has(key)}
              onSave={handleSaveCellRef.current}
            />
          ) : (
            <span className={cn("px-2", value === null ? "text-slate-300" : "text-slate-700")}>
              {formatCell(value, mode, row.original.glam2)}
            </span>
          );
        },
      })),
      {
        id: "total",
        accessorKey: "total",
        header: "Total",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => (
          <span className="block text-right text-sm font-semibold tabular-nums text-slate-800">
            {mode === "pesosm2"
              ? row.original.glam2 > 0
                ? formatDecimal(row.original.total / row.original.glam2)
                : "—"
              : formatClp(row.original.total)}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.periods, mode, canEdit],
  );

  const tableInstance = useReactTable({
    data: rowsWithOverrides,
    columns,
    filterFns: { inList: inListFilterFn },
    defaultColumn: { filterFn: "inList" as unknown as FilterFn<BudgetedSalesMatrixRow> },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  });

  // KPI cards always use unfiltered totals
  const totalBudgetPesos = useMemo(
    () => rowsWithOverrides.reduce((acc, row) => acc + row.total, 0),
    [rowsWithOverrides],
  );
  const tenantsWithData = rowsWithOverrides.filter((row) =>
    data.periods.some((p) => row.byPeriod[p] !== null && row.byPeriod[p] !== undefined),
  ).length;
  const tenantsWithMissing = rowsWithOverrides.filter((row) => {
    const hasAny = data.periods.some(
      (p) => row.byPeriod[p] !== null && row.byPeriod[p] !== undefined,
    );
    return hasAny && row.missingPeriods.length > 0;
  }).length;

  const hasRows = rowsWithOverrides.length > 0;

  // Footer totals reflect only visible (filtered) rows
  const visibleRows = tableInstance.getRowModel().rows;
  const footerTotals: Record<string, number> = {};
  for (const p of data.periods) footerTotals[p] = 0;
  for (const tableRow of visibleRows) {
    for (const p of data.periods) {
      const v = tableRow.original.byPeriod[p];
      if (v !== null && v !== undefined) footerTotals[p] += v;
    }
  }
  const footerTotal = visibleRows.reduce((acc, r) => acc + r.original.total, 0);

  const description = canEdit
    ? "Matriz mensual editable: haz clic en una celda para ingresar o corregir el presupuesto. Use el toggle para ver Pesos totales o Pesos/m²."
    : "Matriz mensual de ventas presupuestadas cargadas por arrendatario. Use el toggle para ver Pesos totales o Pesos/m².";

  return (
    <main className={cn("space-y-4", isPending && "opacity-60")}>
      <ModuleHeader
        title="Ventas Presupuestadas por Arrendatario"
        description={description}
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
            message="No hay arrendatarios en el proyecto para cargar ventas presupuestadas."
            actionHref="/imports"
            actionLabel="Cargar ventas presupuestadas"
          />
        </ModuleSectionCard>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              title="Presupuesto total (Pesos)"
              value={formatClp(totalBudgetPesos)}
              subtitle={`${data.periods.length} meses en rango`}
              accent="slate"
            />
            <KpiCard
              title="Arrendatarios con datos"
              value={tenantsWithData}
              subtitle={
                tenantsWithData > 0
                  ? `${data.periods.length * tenantsWithData} celdas posibles`
                  : "—"
              }
              accent="green"
            />
            <KpiCard
              title="Con meses faltantes"
              value={tenantsWithMissing}
              subtitle={
                tenantsWithMissing > 0
                  ? "Revisar carga de ventas presupuestadas"
                  : "Todos los meses cargados"
              }
              accent={tenantsWithMissing > 0 ? "yellow" : "green"}
            />
          </section>

          <ModuleSectionCard
            title="Desglose mensual"
            headerAction={
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                <Button
                  type="button"
                  variant={mode === "pesos" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("pesos")}
                  className="rounded-none"
                >
                  Pesos
                </Button>
                <Button
                  type="button"
                  variant={mode === "pesosm2" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("pesosm2")}
                  className="rounded-none"
                >
                  Pesos/m²
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className={compactTheme.table}>
                <thead className={compactTheme.head}>
                  {tableInstance.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className={cn(
                            header.column.columnDef.meta?.sticky
                              ? compactTheme.headCell
                              : compactTheme.compactHeadCell,
                            header.column.columnDef.meta?.sticky && "sticky left-0 z-10 bg-brand-700",
                          )}
                        >
                          <ExcelColumnHeader header={header} />
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(getStripedRowClass(index, "compact"), compactTheme.rowHover)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            cell.column.columnDef.meta?.sticky
                              ? "sticky left-0 z-10 bg-inherit px-3 py-1 font-medium text-slate-800"
                              : cell.column.id === "total"
                              ? "px-2.5 py-1 text-right text-sm font-semibold tabular-nums text-slate-800"
                              : cell.column.id === "glam2"
                              ? "px-2.5 py-1"
                              : "px-1 py-0.5 text-right tabular-nums text-sm",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                  <tr>
                    <td className="sticky left-0 z-10 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-800">
                      Total
                    </td>
                    <td className="px-2.5 py-1.5" />
                    {data.periods.map((p) => (
                      <td
                        key={p}
                        className="px-2.5 py-1.5 text-right text-sm font-semibold tabular-nums text-slate-800"
                      >
                        {mode === "pesos" ? formatClp(footerTotals[p] ?? 0) : "—"}
                      </td>
                    ))}
                    <td className="px-2.5 py-1.5 text-right text-sm font-semibold tabular-nums text-slate-800">
                      {mode === "pesos" ? formatClp(footerTotal) : "—"}
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
