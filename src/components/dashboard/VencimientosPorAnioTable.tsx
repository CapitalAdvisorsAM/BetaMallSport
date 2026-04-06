"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { cn, formatUf } from "@/lib/utils";
import { formatPercent } from "@/lib/kpi";

type VencimientoPorAnioRow = {
  anio: number;
  cantidadContratos: number;
  m2: number;
  pctTotal: number;
};

type VencimientosPorAnioTableProps = {
  rows: VencimientoPorAnioRow[];
  currentYear: number;
};

function urgencyClassForYear(year: number, currentYear: number): string {
  if (year === currentYear) {
    return "text-rose-700";
  }
  if (year === currentYear + 1) {
    return "text-amber-700";
  }
  return "text-slate-700";
}

export function VencimientosPorAnioTable({
  rows,
  currentYear
}: VencimientosPorAnioTableProps): JSX.Element {
  const columns = useMemo<ColumnDef<VencimientoPorAnioRow, unknown>[]>(
    () => [
      {
        accessorKey: "anio",
        header: "Ano",
        filterFn: "inNumberRange",
        meta: { filterType: "number" },
        cell: ({ row }) => (
          <span className={cn("whitespace-nowrap font-semibold", urgencyClassForYear(row.original.anio, currentYear))}>
            {row.original.anio}
          </span>
        )
      },
      {
        accessorKey: "cantidadContratos",
        header: "Contratos",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.cantidadContratos}</span>
      },
      {
        accessorKey: "m2",
        header: "m2",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatUf(row.original.m2)}</span>
      },
      {
        accessorKey: "pctTotal",
        header: "% del total",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatPercent(row.original.pctTotal)}</span>
      }
    ],
    [currentYear]
  );

  const { table } = useDataTable(rows, columns);

  return <DataTable table={table} emptyMessage="No hay vencimientos en el horizonte de 5 anos." />;
}
