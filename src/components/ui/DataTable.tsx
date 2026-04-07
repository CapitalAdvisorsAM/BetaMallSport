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
import { ChevronDown, ChevronUp, ChevronsUpDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { mapSortStateToAriaSort } from "@/components/ui/table-a11y";
import { getStripedRowClass, getTableTheme, type TableDensity } from "@/components/ui/table-theme";
import { cn } from "@/lib/utils";
import { RecordDetailModal } from "@/components/ui/RecordDetailModal";


type DataTableFilterType = "string" | "enum" | "number";
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
    filterType?: DataTableFilterType;
    isNumeric?: boolean;
    isCritical?: boolean;
    summary?: DataTableSummaryMeta;
    linkTo?: {
      path?: string;
      idKey?: string;
      triggerDetail?: boolean;
    };
  }
}

interface DataTableProps<TData> {
  table: TanStackTable<TData>;
  emptyMessage?: string;
  footerContent?: React.ReactNode;
  summaryRow?: DataTableSummaryConfig;
  density?: TableDensity;
  getRowClassName?: (row: Row<TData>, index: number) => string | undefined;
  renderSubRow?: (row: Row<TData>) => React.ReactNode;
  selectedId?: string;
}

interface SortableColumnHeaderProps<TData> {
  column: Column<TData, unknown>;
  title: React.ReactNode;
}

function getColumnAlign<TData>(column: Column<TData, unknown>): DataTableAlign {
  return column.columnDef.meta?.align ?? "left";
}

function getCellAlignClass(align: DataTableAlign): string {
  if (align === "right") {
    return "text-right";
  }
  if (align === "center") {
    return "text-center";
  }
  return "text-left";
}

function getFilterType<TData>(column: Column<TData, unknown>): DataTableFilterType {
  if (column.columnDef.meta?.filterType) {
    return column.columnDef.meta.filterType;
  }
  if (column.columnDef.meta?.filterOptions?.length) {
    return "enum";
  }
  return "string";
}

function getSummaryMeta<TData>(column: Column<TData, unknown>): DataTableSummaryMeta | undefined {
  return column.columnDef.meta?.summary;
}

function hasActiveFilter<TData>(column: Column<TData, unknown>): boolean {
  const filterType = getFilterType(column);
  const filterValue = column.getFilterValue();

  if (filterType === "enum") {
    return Array.isArray(filterValue) && filterValue.length > 0;
  }

  if (filterType === "number") {
    if (!Array.isArray(filterValue)) {
      return false;
    }
    const [min, max] = filterValue as [number | undefined, number | undefined];
    return min !== undefined || max !== undefined;
  }

  return typeof filterValue === "string" && filterValue.trim().length > 0;
}

function SortableColumnHeader<TData>({
  column,
  title
}: SortableColumnHeaderProps<TData>): JSX.Element {
  const sortState = column.getIsSorted();
  const align = getColumnAlign(column);
  const isActiveSort = sortState !== false;
  const Icon = sortState === "asc" ? ChevronUp : sortState === "desc" ? ChevronDown : ChevronsUpDown;

  const onSortToggle = (): void => {
    if (!column.getCanSort()) {
      return;
    }
    if (sortState === "asc") {
      column.toggleSorting(true);
      return;
    }
    if (sortState === "desc") {
      column.clearSorting();
      return;
    }
    column.toggleSorting(false);
  };

  return (
    <button
      type="button"
      onClick={onSortToggle}
      disabled={!column.getCanSort()}
      aria-label={`Ordenar por ${column.id}`}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-brand-700 disabled:pointer-events-none",
        align === "right" && "justify-end",
        align === "center" && "justify-center"
      )}
    >
      <span>{title}</span>
      <Icon className={cn("h-3.5 w-3.5", isActiveSort ? "text-gold-400" : "text-white/40")} />
    </button>
  );
}

function ColumnFilterControl<TData>({ column }: { column: Column<TData, unknown> }): JSX.Element {
  const filterType = getFilterType(column);
  const isActive = hasActiveFilter(column);
  const options = column.columnDef.meta?.filterOptions ?? [];

  const filterValue = column.getFilterValue();
  const textValue = typeof filterValue === "string" ? filterValue : "";
  const enumValues = Array.isArray(filterValue) ? (filterValue as string[]) : [];
  const numberRange: [number | undefined, number | undefined] = Array.isArray(filterValue)
    ? (filterValue as [number | undefined, number | undefined])
    : [undefined, undefined];

  const clearFilter = (): void => {
    column.setFilterValue(undefined);
  };

  const updateEnumFilter = (value: string, checked: boolean): void => {
    const nextValues = checked ? [...enumValues, value] : enumValues.filter((item) => item !== value);
    column.setFilterValue(nextValues.length > 0 ? nextValues : undefined);
  };

  const updateNumberFilter = (position: 0 | 1, value: string): void => {
    const parsed = value.trim().length === 0 ? undefined : Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : undefined;
    const nextRange: [number | undefined, number | undefined] = [...numberRange];
    nextRange[position] = safeValue;
    column.setFilterValue(nextRange[0] !== undefined || nextRange[1] !== undefined ? nextRange : undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-brand-700"
          aria-label={`Filtrar columna ${column.id}`}
        >
          <Filter className={cn("h-3.5 w-3.5", isActive ? "text-gold-400" : "text-white/40")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        {filterType === "enum" ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Filtrar valores
            </p>
            <div className="max-h-44 space-y-2 overflow-y-auto">
              {options.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={enumValues.includes(option)}
                    onChange={(event) => updateEnumFilter(option, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {filterType === "number" ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rango</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                value={numberRange[0] ?? ""}
                onChange={(event) => updateNumberFilter(0, event.target.value)}
                placeholder="Min"
                className="h-9"
              />
              <Input
                type="number"
                value={numberRange[1] ?? ""}
                onChange={(event) => updateNumberFilter(1, event.target.value)}
                placeholder="Max"
                className="h-9"
              />
            </div>
          </div>
        ) : null}

        {filterType === "string" ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Buscar texto
            </p>
            <Input
              value={textValue}
              onChange={(event) => column.setFilterValue(event.target.value || undefined)}
              placeholder="Escribe para filtrar..."
              className="h-9"
            />
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={clearFilter}>
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function renderHeader<TData>(header: Header<TData, unknown>): React.ReactNode {
  if (header.isPlaceholder) {
    return null;
  }

  const align = getColumnAlign(header.column);
  const renderedTitle = flexRender(header.column.columnDef.header, header.getContext()) ?? header.column.id;

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        align === "right" && "justify-end",
        align === "center" && "justify-center"
      )}
    >
      <SortableColumnHeader column={header.column} title={renderedTitle} />
      {header.column.getCanFilter() ? <ColumnFilterControl column={header.column} /> : null}
    </div>
  );
}

export function DataTable<TData>({
  table,
  emptyMessage = "No hay filas para mostrar.",
  footerContent,
  summaryRow,
  density = "default",
  getRowClassName,
  renderSubRow,
  selectedId
}: DataTableProps<TData>): JSX.Element {
  const router = useRouter();
  const [selectedRecord, setSelectedRecord] = React.useState<TData | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const theme = getTableTheme(density);
  const rows = table.getRowModel().rows;
  const totalRows = table.getCoreRowModel().rows.length;
  const filteredRows = table.getFilteredRowModel().rows.length;
  const hasActiveFilters = table.getState().columnFilters.length > 0;
  const visibleColumns = table.getVisibleLeafColumns();
  const columnCount = visibleColumns.length;


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

  return (
    <>
      <UnifiedTable density={density}>
        <Table density={density} className={theme.table}>
          <TableHeader className={theme.head}>
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
                        getCellAlignClass(getColumnAlign(header.column))
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
                rows.map((row, index) => (
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
                              cell.column.columnDef.meta?.isNumeric && "tabular-nums text-right",
                              cell.column.columnDef.meta?.isCritical && "font-mono font-semibold"
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
                ))
              ) : (
                <TableRow className="bg-white hover:bg-white">
                  <TableCell
                    colSpan={columnCount}
                    className={cn(theme.cell, "py-6 text-center text-sm text-slate-500")}
                  >
                    {emptyMessage}
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
                      {filteredRows} de {totalRows} filas
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
                            `whitespace-nowrap ${theme.cell}`,
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
        </UnifiedTable>
        <RecordDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          recordData={selectedRecord as Record<string, unknown>}
        />
    </>
  );
}
