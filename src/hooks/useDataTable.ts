import { useState } from "react";
import {
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type FilterFn,
  type SortingState
} from "@tanstack/react-table";

// Used by ExcelColumnHeader checklist UI: filter value is always string[].
// Falls back gracefully when the column has no filter value set.
const inListFilterFn: FilterFn<unknown> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  return filterValue.includes(String(row.getValue(columnId) ?? ""));
};
inListFilterFn.autoRemove = (val: unknown) =>
  !Array.isArray(val) || (val as unknown[]).length === 0;

export function useDataTable<TData>(
  data: TData[],
  columns: ColumnDef<TData, unknown>[],
  options?: { expandable?: boolean }
) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    filterFns: { inList: inListFilterFn as FilterFn<TData> },
    defaultColumn: { filterFn: "inList" as unknown as FilterFn<TData> },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    ...(options?.expandable
      ? {
          getExpandedRowModel: getExpandedRowModel(),
          onExpandedChange: setExpanded,
          state: { sorting, columnFilters, expanded }
        }
      : { state: { sorting, columnFilters } })
  });

  return { table };
}
