"use client";

import * as React from "react";
import {
  flexRender,
  type Column,
  type Header,
  type RowData,
  type Table as TanStackTable
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableFilterType = "string" | "enum" | "number";
type DataTableAlign = "left" | "center" | "right";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    _types?: [TData, TValue];
    align?: DataTableAlign;
    filterOptions?: string[];
    filterType?: DataTableFilterType;
  }
}

interface DataTableProps<TData> {
  table: TanStackTable<TData>;
  emptyMessage?: string;
  footerContent?: React.ReactNode;
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
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white/70 transition-colors hover:text-white disabled:pointer-events-none",
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
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm transition-colors hover:bg-white/10"
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
  footerContent
}: DataTableProps<TData>): JSX.Element {
  const rows = table.getRowModel().rows;
  const totalRows = table.getCoreRowModel().rows.length;
  const filteredRows = table.getFilteredRowModel().rows.length;
  const hasActiveFilters = table.getState().columnFilters.length > 0;
  const columnCount = table.getAllLeafColumns().length;

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="overflow-x-auto">
        <Table className="min-w-full text-sm">
          <TableHeader className="bg-brand-700 text-white/70">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70",
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
                <TableRow
                  key={row.id}
                  className={cn(index % 2 === 0 ? "bg-white" : "bg-slate-50/60", "hover:bg-brand-50")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn("px-4 py-3 text-slate-700", getCellAlignClass(getColumnAlign(cell.column)))}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext()) ??
                        String(cell.getValue() ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="bg-white hover:bg-white">
                <TableCell colSpan={columnCount} className="px-4 py-6 text-center text-sm text-slate-500">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {footerContent || hasActiveFilters ? (
            <TableFooter className="bg-white">
              {footerContent}
              {hasActiveFilters ? (
                <TableRow className="border-t border-slate-200 bg-white hover:bg-white">
                  <TableCell colSpan={columnCount} className="px-4 py-2 text-right text-xs text-slate-500">
                    {filteredRows} de {totalRows} filas
                  </TableCell>
                </TableRow>
              ) : null}
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </div>
  );
}
