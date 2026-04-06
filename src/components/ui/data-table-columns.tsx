"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export function enumFilterPredicate(rowValue: unknown, filterValue: unknown): boolean {
  if (!Array.isArray(filterValue) || filterValue.length === 0) {
    return true;
  }
  return filterValue.includes(String(rowValue));
}

type EnumFilterColumnOptions<TData> = {
  id?: string;
  accessorKey?: keyof TData & string;
  accessorFn?: (row: TData) => string;
  header: string;
  options: string[];
  cell?: (row: TData) => ReactNode;
  align?: "left" | "center" | "right";
  enableSorting?: boolean;
};

export function enumFilterColumn<TData>(
  options: EnumFilterColumnOptions<TData>
): ColumnDef<TData, unknown> {
  return {
    ...(options.id ? { id: options.id } : {}),
    ...(options.accessorKey ? { accessorKey: options.accessorKey } : {}),
    ...(options.accessorFn ? { accessorFn: options.accessorFn } : {}),
    header: options.header,
    enableSorting: options.enableSorting,
    filterFn: (row, columnId, filterValue) =>
      enumFilterPredicate(row.getValue(columnId), filterValue),
    meta: { filterType: "enum", filterOptions: options.options, align: options.align },
    cell: options.cell
      ? ({ row }) => options.cell?.(row.original)
      : ({ row }) => <span>{String(row.getValue(options.id ?? options.accessorKey ?? ""))}</span>
  };
}

type NumberFilterColumnOptions<TData> = {
  id?: string;
  accessorKey?: keyof TData & string;
  accessorFn?: (row: TData) => number;
  header: string;
  cell?: (row: TData) => ReactNode;
  align?: "left" | "center" | "right";
};

export function numberFilterColumn<TData>(
  options: NumberFilterColumnOptions<TData>
): ColumnDef<TData, unknown> {
  return {
    ...(options.id ? { id: options.id } : {}),
    ...(options.accessorKey ? { accessorKey: options.accessorKey } : {}),
    ...(options.accessorFn ? { accessorFn: options.accessorFn } : {}),
    header: options.header,
    filterFn: "inNumberRange",
    meta: { filterType: "number", align: options.align ?? "right" },
    cell: options.cell
      ? ({ row }) => options.cell?.(row.original)
      : ({ row }) => <span>{String(row.getValue(options.id ?? options.accessorKey ?? ""))}</span>
  };
}

type StatusBadgeColumnOptions<TData> = {
  id?: string;
  accessorKey?: keyof TData & string;
  accessorFn?: (row: TData) => string;
  header: string;
  options: string[];
  getValue: (row: TData) => string;
  getClassName: (value: string, row: TData) => string;
  align?: "left" | "center" | "right";
};

export function statusBadgeColumn<TData>(
  options: StatusBadgeColumnOptions<TData>
): ColumnDef<TData, unknown> {
  return {
    ...(options.id ? { id: options.id } : {}),
    ...(options.accessorKey ? { accessorKey: options.accessorKey } : {}),
    ...(options.accessorFn ? { accessorFn: options.accessorFn } : {}),
    header: options.header,
    filterFn: (row, columnId, filterValue) =>
      enumFilterPredicate(row.getValue(columnId), filterValue),
    meta: { filterType: "enum", filterOptions: options.options, align: options.align ?? "center" },
    cell: ({ row }) => {
      const value = options.getValue(row.original);
      return (
        <Badge variant="outline" className={options.getClassName(value, row.original)}>
          {value}
        </Badge>
      );
    }
  };
}

type LinkColumnOptions<TData> = {
  id?: string;
  accessorKey?: keyof TData & string;
  accessorFn?: (row: TData) => string;
  header: string;
  href: (row: TData) => string;
  label: (row: TData) => ReactNode;
  className?: string;
  filterFn?: "includesString";
};

export function linkColumn<TData>(options: LinkColumnOptions<TData>): ColumnDef<TData, unknown> {
  return {
    ...(options.id ? { id: options.id } : {}),
    ...(options.accessorKey ? { accessorKey: options.accessorKey } : {}),
    ...(options.accessorFn ? { accessorFn: options.accessorFn } : {}),
    header: options.header,
    filterFn: options.filterFn ?? "includesString",
    cell: ({ row }) => (
      <Link
        href={options.href(row.original)}
        className={options.className ?? "font-medium text-brand-700 underline"}
      >
        {options.label(row.original)}
      </Link>
    )
  };
}
