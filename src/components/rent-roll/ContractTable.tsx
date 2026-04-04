import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { formatDateString } from "@/lib/utils";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import type { RentRollRow } from "@/types";

type ContractTableProps = {
  rows: RentRollRow[];
};

function parseDecimal(value: string): number | undefined {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ContractTable({ rows }: ContractTableProps): JSX.Element {
  const columns = useMemo<ColumnDef<RentRollRow, unknown>[]>(
    () => [
      {
        accessorKey: "local",
        header: "Local",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium text-slate-900">{row.original.local}</span>
        )
      },
      {
        accessorKey: "arrendatario",
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap text-slate-700">{row.original.arrendatario}</span>
      },
      {
        accessorKey: "fechaInicio",
        header: "Condiciones contractuales",
        enableColumnFilter: false,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {formatDateString(row.original.fechaInicio)} - {formatDateString(row.original.fechaTermino)}
          </span>
        )
      },
      {
        id: "tarifaVigenteUfM2",
        accessorFn: (row) => parseDecimal(row.tarifaVigenteUfM2),
        header: "Tarifa vigente (UF/m2)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{row.original.tarifaVigenteUfM2}</span>
        )
      },
      {
        id: "m2",
        accessorFn: (row) => parseDecimal(row.m2),
        header: "m2",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap text-slate-700">{row.original.m2}</span>
      }
    ],
    []
  );

  const { table } = useDataTable(rows, columns);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No hay contratos para los filtros seleccionados.
      </div>
    );
  }

  return (
    <DataTable table={table} emptyMessage="No hay contratos para los filtros seleccionados." />
  );
}
