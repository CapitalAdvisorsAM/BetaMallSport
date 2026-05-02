"use client";

import * as React from "react";
import {
  flexRender,
  type Column,
  type Header,
  type Row,
  type RowData,
  type Table as TanStackTable
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronUp, Inbox, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { mapSortStateToAriaSort } from "@/components/ui/table-a11y";
import { getStripedRowClass, getTableTheme, type TableDensity } from "@/components/ui/table-theme";
import { cn } from "@/lib/utils";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";


// "string" | "enum" → checklist UI (enum = predefined options, string = auto from data)
// "text" → free text input (substring search, uses filterFn: "includesString")
// "number" → min/max range
type DataTableFilterType = "string" | "enum" | "number" | "text";
type DataTableAlign = "left" | "center" | "right";
type DataTableSummaryMeta = {
  type: "sum";
  formatter?: (value: number) => React.ReactNode;
};
type DataTableSummaryConfig = {
  enabled?: boolean;
  label?: string;
};

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    _types?: [TData, TValue];
    align?: DataTableAlign;
    filterOptions?: string[];
    filterType?: DataTableFilterType; // "text" = free search; "string"/"enum" = checklist; "number" = range
    isNumeric?: boolean;
    isCritical?: boolean;
    sticky?: boolean; // pin column to left edge (sticky left-0)
    summary?: DataTableSummaryMeta;
    linkTo?: {
      path?: string;
      idKey?: string;
      triggerDetail?: boolean;
    };
  }
}

const VIRTUALIZATION_THRESHOLD = 100;

const DENSITY_ROW_HEIGHT: Record<TableDensity, number> = {
  compact: 29,
  default: 37,
  comfortable: 45,
};

interface DataTableProps<TData> {
  table: TanStackTable<TData>;
  emptyMessage?: string;
  footerContent?: React.ReactNode;
  summaryRow?: DataTableSummaryConfig;
  density?: TableDensity;
  getRowClassName?: (row: Row<TData>, index: number) => string | undefined;
  renderSubRow?: (row: Row<TData>) => React.ReactNode;
  selectedId?: string;
  virtualize?: boolean;
}

function getColumnAlign<TData>(column: Column<TData, unknown>): DataTableAlign {
  return column.columnDef.meta?.align ?? "left";
}

function getCellAlignClass(align: DataTableAlign): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

function getFilterType<TData>(column: Column<TData, unknown>): DataTableFilterType {
  if (column.columnDef.meta?.filterType) return column.columnDef.meta.filterType;
  if (column.columnDef.meta?.filterOptions?.length) return "enum";
  // Columns with explicit substring filterFns keep text-input UI (no migration needed).
  const fn = column.columnDef.filterFn;
  if (fn === "includesString" || fn === "includesStringSensitive" || fn === "weakEquals") {
    return "text";
  }
  // Default: checklist auto-populated from faceted unique values.
  return "string";
}

function isChecklistType(filterType: DataTableFilterType): boolean {
  return filterType === "string" || filterType === "enum";
}

function getSummaryMeta<TData>(column: Column<TData, unknown>): DataTableSummaryMeta | undefined {
  return column.columnDef.meta?.summary;
}

function hasActiveFilter<TData>(column: Column<TData, unknown>): boolean {
  const filterValue = column.getFilterValue();
  const filterType = getFilterType(column);
  if (isChecklistType(filterType)) return Array.isArray(filterValue) && filterValue.length > 0;
  if (filterType === "number") {
    if (!Array.isArray(filterValue)) return false;
    const [min, max] = filterValue as [number | undefined, number | undefined];
    return min !== undefined || max !== undefined;
  }
  // "text"
  return typeof filterValue === "string" && filterValue.trim().length > 0;
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  const ref = React.useCallback(
    (el: HTMLInputElement | null) => {
      if (el) el.indeterminate = indeterminate;
    },
    [indeterminate]
  );
  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
    />
  );
}

export function ExcelColumnHeader<TData>({ header }: { header: Header<TData, unknown> }): JSX.Element {
  const column = header.column;
  const align = getColumnAlign(column);
  const filterType = getFilterType(column);
  const canSort = column.getCanSort();
  const canFilter = column.getCanFilter();
  const sortState = column.getIsSorted();
  const isActiveSort = sortState !== false;
  const isActiveFilter = hasActiveFilter(column);
  const isActive = isActiveSort || isActiveFilter;

  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const filterValue = column.getFilterValue();
  const textValue = typeof filterValue === "string" ? filterValue : "";
  const enumValues = Array.isArray(filterValue) ? (filterValue as string[]) : [];
  const numberRange: [number | undefined, number | undefined] = Array.isArray(filterValue)
    ? (filterValue as [number | undefined, number | undefined])
    : [undefined, undefined];

  // Dynamic unique values from faceted model, or predefined options
  const predefinedOptions = column.columnDef.meta?.filterOptions ?? [];
  let facetedMap: Map<unknown, number> | undefined;
  try {
    facetedMap = column.getFacetedUniqueValues?.();
  } catch {
    // getFacetedUniqueValues not ready or table not fully initialized
  }
  const dynamicOptions = facetedMap
    ? [...facetedMap.keys()].filter((v) => v != null && v !== "").map(String).sort()
    : [];
  const allOptions = predefinedOptions.length > 0 ? predefinedOptions : dynamicOptions;
  const filteredOptions = search.trim()
    ? allOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : allOptions;

  const allSelected = allOptions.length > 0 && allOptions.every((o) => enumValues.includes(o));
  const someSelected = enumValues.length > 0 && !allSelected;

  const renderedTitle = header.isPlaceholder
    ? null
    : (flexRender(column.columnDef.header, header.getContext()) ?? column.id);

  const updateEnumFilter = (value: string, checked: boolean): void => {
    const next = checked ? [...enumValues, value] : enumValues.filter((v) => v !== value);
    column.setFilterValue(next.length > 0 ? next : undefined);
  };

  const toggleAll = (checked: boolean): void => {
    column.setFilterValue(checked ? allOptions : undefined);
  };

  const updateNumberFilter = (position: 0 | 1, value: string): void => {
    const parsed = value.trim() === "" ? undefined : Number(value);
    const safe = Number.isFinite(parsed) ? parsed : undefined;
    const next: [number | undefined, number | undefined] = [...numberRange];
    next[position] = safe;
    column.setFilterValue(next[0] !== undefined || next[1] !== undefined ? next : undefined);
  };

  const clearAll = (): void => {
    column.setFilterValue(undefined);
    column.clearSorting();
    setSearch("");
    setOpen(false);
  };

  if (!canSort && !canFilter) {
    return (
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest text-white/70",
          align === "right" && "block text-right",
          align === "center" && "block text-center"
        )}
      >
        {renderedTitle}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group -mx-2 -my-1 flex w-[calc(100%+1rem)] items-center gap-1 rounded-sm px-2 py-1 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            align === "right" && "flex-row-reverse",
            align === "center" && "justify-center"
          )}
        >
          <span
            className={cn(
              "flex-1 truncate text-[10px] font-bold uppercase tracking-widest transition-colors",
              isActive ? "text-white" : "text-white/70 group-hover:text-white/90",
              align === "right" && "text-right",
              align === "center" && "text-center"
            )}
          >
            {renderedTitle}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
            {sortState === "asc" && <ChevronUp className="h-3 w-3 text-gold-400" />}
            {sortState === "desc" && <ChevronDown className="h-3 w-3 text-gold-400" />}
            {isActiveFilter && (
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold-400 text-[9px] font-bold leading-none text-brand-900">
                {filterType === "enum" ? enumValues.length : "•"}
              </span>
            )}
            {!isActive && (
              <ChevronDown className="h-3 w-3 text-white/30 transition-colors group-hover:text-white/60" />
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-60 overflow-hidden p-0 shadow-lg">
        {/* Sort section */}
        {canSort && (
          <div className="border-b border-slate-100 p-1">
            <button
              type="button"
              onClick={() => { column.toggleSorting(false); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-slate-50",
                sortState === "asc" && "bg-brand-50 font-medium text-brand-700"
              )}
            >
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>Ordenar A → Z</span>
              {sortState === "asc" && <span className="ml-auto text-xs text-brand-500">✓</span>}
            </button>
            <button
              type="button"
              onClick={() => { column.toggleSorting(true); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-slate-50",
                sortState === "desc" && "bg-brand-50 font-medium text-brand-700"
              )}
            >
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>Ordenar Z → A</span>
              {sortState === "desc" && <span className="ml-auto text-xs text-brand-500">✓</span>}
            </button>
          </div>
        )}

        {/* Filter section — checklist (string auto-from-data + enum predefined) */}
        {canFilter && isChecklistType(filterType) && (
          <div className="p-2 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {allOptions.length > 0 ? (
              <div>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                  <IndeterminateCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                  <span className="font-medium text-slate-700">(Seleccionar todo)</span>
                </label>
                <div className="my-1 border-t border-slate-100" />
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {filteredOptions.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={enumValues.includes(option)}
                        onChange={(e) => updateEnumFilter(option, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="truncate text-slate-700">{option}</span>
                    </label>
                  ))}
                  {filteredOptions.length === 0 && (
                    <p className="py-3 text-center text-xs text-slate-400">Sin resultados</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-slate-400">Sin opciones disponibles</p>
            )}
          </div>
        )}

        {/* Filter section — free text search (filterType: "text") */}
        {canFilter && filterType === "text" && (
          <div className="p-2 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={textValue}
                onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                placeholder="Buscar texto..."
                autoFocus
                className="w-full rounded border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              {textValue && (
                <button
                  type="button"
                  onClick={() => column.setFilterValue(undefined)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter section — number range */}
        {canFilter && filterType === "number" && (
          <div className="p-2 space-y-2">
            <p className="text-xs font-medium text-slate-500">Rango de valores</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={numberRange[0] ?? ""}
                onChange={(e) => updateNumberFilter(0, e.target.value)}
                placeholder="Min"
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <input
                type="number"
                value={numberRange[1] ?? ""}
                onChange={(e) => updateNumberFilter(1, e.target.value)}
                placeholder="Max"
                className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
        )}

        {/* Footer: clear all */}
        {(isActive) && (
          <div className="border-t border-slate-100 p-1.5">
            <button
              type="button"
              onClick={clearAll}
              className="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <X className="h-3 w-3" />
              Limpiar filtros y orden
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function renderHeader<TData>(header: Header<TData, unknown>): React.ReactNode {
  if (header.isPlaceholder) return null;
  return <ExcelColumnHeader header={header} />;
}

export function DataTable<TData>({
  table,
  emptyMessage = "No hay filas para mostrar.",
  footerContent,
  summaryRow,
  density = "default",
  getRowClassName,
  renderSubRow,
  selectedId,
  virtualize = true,
}: DataTableProps<TData>): JSX.Element {
  const router = useRouter();
  const [selectedRecord, setSelectedRecord] = React.useState<TData | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const theme = getTableTheme(density);
  const rows = table.getRowModel().rows;
  const totalRows = table.getCoreRowModel().rows.length;
  const filteredRows = table.getFilteredRowModel().rows.length;
  const hasActiveFilters = table.getState().columnFilters.length > 0;
  const visibleColumns = table.getVisibleLeafColumns();
  const columnCount = visibleColumns.length;

  const shouldVirtualize = virtualize && rows.length > VIRTUALIZATION_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? rows.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => DENSITY_ROW_HEIGHT[density],
    overscan: 10,
  });


  const summaryEnabled = summaryRow?.enabled ?? false;
  const summaryLabel = summaryRow?.label ?? "Totales";
  const summaryColumns = visibleColumns
    .map((column, index) => ({ column, index, summary: getSummaryMeta(column) }))
    .filter((item) => item.summary?.type === "sum");
  const firstSummaryColumnIndex = summaryColumns.length > 0 ? summaryColumns[0].index : -1;

  const summaryValues = new Map<string, number>();
  if (summaryEnabled && rows.length > 0 && summaryColumns.length > 0) {
    for (const { column } of summaryColumns) {
      summaryValues.set(column.id, 0);
    }

    for (const row of rows) {
      for (const { column } of summaryColumns) {
        const cellValue = row.getValue(column.id);
        if (typeof cellValue !== "number" || !Number.isFinite(cellValue)) {
          continue;
        }
        summaryValues.set(column.id, (summaryValues.get(column.id) ?? 0) + cellValue);
      }
    }
  }

  const showSummaryRow = summaryEnabled && rows.length > 0 && summaryColumns.length > 0;
  const summaryLabelColSpan = firstSummaryColumnIndex <= 0 ? 1 : firstSummaryColumnIndex;
  const summaryCellsStartIndex = firstSummaryColumnIndex === 0 ? 1 : summaryLabelColSpan;
  const firstSummaryColumn = firstSummaryColumnIndex >= 0 ? visibleColumns[firstSummaryColumnIndex] : null;
  const firstSummaryMeta = firstSummaryColumn ? getSummaryMeta(firstSummaryColumn) : undefined;
  const firstSummaryValue = firstSummaryColumn ? (summaryValues.get(firstSummaryColumn.id) ?? 0) : 0;
  const renderedFirstSummaryValue =
    firstSummaryMeta?.type === "sum" && firstSummaryMeta.formatter
      ? firstSummaryMeta.formatter(firstSummaryValue)
      : firstSummaryValue;

  function renderRowContent(row: Row<TData>, index: number) {
    return (
      <React.Fragment key={row.id}>
        <TableRow
          className={cn(
            getStripedRowClass(index, density),
            theme.rowHover,
            getRowClassName?.(row, index),
            (row.original as { id: string }).id === selectedId && "bg-brand-50 border-l-4 border-brand-500"
          )}
        >
          {row.getVisibleCells().map((cell) => {
            const linkTo = cell.column.columnDef.meta?.linkTo;
            const value = cell.getValue();
            const recordId = linkTo?.idKey
              ? (row.original as Record<string, unknown>)[linkTo.idKey]
              : (row.original as Record<string, unknown>).id;

            const handleLinkClick = (e: React.MouseEvent) => {
              if (!linkTo) return;
              e.stopPropagation();

              if (linkTo.triggerDetail || !linkTo.path) {
                setSelectedRecord(row.original);
                setIsModalOpen(true);
              } else {
                router.push(`${linkTo.path}?id=${recordId}`);
              }
            };

            return (
              <TableCell
                key={cell.id}
                className={cn(
                  theme.cell,
                  getCellAlignClass(getColumnAlign(cell.column)),
                  (cell.column.columnDef.meta?.isNumeric || getColumnAlign(cell.column) === "right") && "tabular-nums",
                  cell.column.columnDef.meta?.isNumeric && "text-right",
                  cell.column.columnDef.meta?.isCritical && "font-mono font-semibold",
                  cell.column.columnDef.meta?.sticky && "sticky left-0 z-10 bg-inherit"
                )}
              >
                {linkTo ? (
                  <span
                    onClick={handleLinkClick}
                    className="cursor-pointer text-brand-500 hover:text-brand-700 underline underline-offset-2 font-medium transition-colors"
                    >
                    {flexRender(cell.column.columnDef.cell, cell.getContext()) ??
                      String(value ?? "")}
                  </span>
                ) : (
                  <>
                    {flexRender(cell.column.columnDef.cell, cell.getContext()) ??
                      String(value ?? "")}
                  </>
                )}
              </TableCell>
            );
          })}
        </TableRow>
        {renderSubRow && row.getIsExpanded() ? (
          <TableRow className="bg-slate-50/40 hover:bg-slate-50/40">
            <TableCell colSpan={columnCount} className={theme.cell}>
              {renderSubRow(row)}
            </TableCell>
          </TableRow>
        ) : null}
      </React.Fragment>
    );
  }

  return (
    <>
      <div
        ref={scrollContainerRef}
        className={cn(
          theme.surface,
          shouldVirtualize && "max-h-[600px] overflow-auto"
        )}
      >
        <Table density={density} className={theme.table}>
          <TableHeader className={cn(theme.head, shouldVirtualize && "sticky top-0 z-10")}>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        header.column.getCanSort()
                          ? mapSortStateToAriaSort(header.column.getIsSorted())
                          : undefined
                      }
                      className={cn(
                        theme.headCell,
                        getCellAlignClass(getColumnAlign(header.column)),
                        header.column.columnDef.meta?.sticky && "sticky left-0 z-10 bg-brand-700"
                      )}
                    >
                      {renderHeader(header)}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                shouldVirtualize ? (
                  <>
                    {rowVirtualizer.getVirtualItems().length > 0 && (
                      <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }} />
                    )}
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const row = rows[virtualRow.index];
                      return renderRowContent(row, virtualRow.index);
                    })}
                    {rowVirtualizer.getVirtualItems().length > 0 && (
                      <tr
                        style={{
                          height:
                            rowVirtualizer.getTotalSize() -
                            (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0),
                        }}
                      />
                    )}
                  </>
                ) : (
                  rows.map((row, index) => renderRowContent(row, index))
                )
              ) : (
                <TableRow className="bg-white hover:bg-white">
                  <TableCell
                    colSpan={columnCount}
                    className={cn(theme.cell, "py-8 text-center")}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
                      <p className="text-sm text-slate-500">{emptyMessage}</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {footerContent || hasActiveFilters || showSummaryRow ? (
              <TableFooter className="bg-white">
                {footerContent}
                {hasActiveFilters ? (
                  <TableRow className="border-t border-slate-200 bg-white hover:bg-white">
                    <TableCell colSpan={columnCount} className={cn(theme.cell, "py-2 text-right text-xs text-slate-500")}>
                      <span aria-live="polite" aria-atomic="true">
                        {filteredRows} de {totalRows} filas
                      </span>
                    </TableCell>
                  </TableRow>
                ) : null}
                {showSummaryRow ? (
                  <TableRow className="border-t border-slate-200 bg-brand-50 font-semibold text-slate-900 hover:bg-brand-50">
                    <TableCell className={cn(theme.cell, "font-semibold")} colSpan={summaryLabelColSpan}>
                      {firstSummaryColumnIndex === 0 ? (
                        <div className="flex items-center justify-between gap-2">
                          <span>{summaryLabel}</span>
                          <span className="whitespace-nowrap">{renderedFirstSummaryValue}</span>
                        </div>
                      ) : (
                        summaryLabel
                      )}
                    </TableCell>
                    {visibleColumns.slice(summaryCellsStartIndex).map((column) => {
                      const summaryMeta = getSummaryMeta(column);
                      if (summaryMeta?.type !== "sum") {
                        return (
                          <TableCell
                            key={`summary-empty-${column.id}`}
                            className={cn(theme.cell, getCellAlignClass(getColumnAlign(column)))}
                          />
                        );
                      }

                      const value = summaryValues.get(column.id) ?? 0;
                      return (
                        <TableCell
                          key={`summary-${column.id}`}
                          className={cn(
                            `whitespace-nowrap tabular-nums ${theme.cell}`,
                            getCellAlignClass(getColumnAlign(column))
                          )}
                        >
                          {summaryMeta.formatter ? summaryMeta.formatter(value) : value}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ) : null}
              </TableFooter>
            ) : null}
          </Table>
      </div>
        <RecordDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          recordData={selectedRecord as Record<string, unknown>}
        />
    </>
  );
}
