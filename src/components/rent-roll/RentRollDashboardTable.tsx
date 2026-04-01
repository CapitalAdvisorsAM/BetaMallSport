"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { formatDecimal } from "@/lib/utils";
import { DataTable } from "@/components/ui/DataTable";
import { TableCell, TableRow } from "@/components/ui/table";
import { useDataTable } from "@/hooks/useDataTable";

export type RentRollDashboardTableRow = {
  id: string;
  local: string;
  arrendatario: string;
  glam2: number;
  tarifaUfM2: number;
  rentaFijaUf: number;
  ggccUf: number;
  ventasUf: number | null;
  pctRentaVariable: number | null;
  rentaVariableUf: number | null;
  pctFondoPromocion: number | null;
};

type RentRollDashboardTableProps = {
  rows: RentRollDashboardTableRow[];
  totals: {
    glam2: number;
    rentaFijaUf: number;
    ggccUf: number;
    ventasUf: number;
    rentaVariableUf: number;
  };
  snapshotDate: string;
};

function renderMetric(value: number | null, suffix = ""): string {
  if (value == null) {
    return "–";
  }
  return `${formatDecimal(value)}${suffix}`;
}

export function RentRollDashboardTable({
  rows,
  totals,
  snapshotDate
}: RentRollDashboardTableProps): JSX.Element {
  const sortedBaseRows = useMemo(
    () => [...rows].sort((a, b) => a.local.localeCompare(b.local, "es-CL")),
    [rows]
  );

  const columns = useMemo<ColumnDef<RentRollDashboardTableRow, unknown>[]>(
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
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{row.original.arrendatario}</span>
        )
      },
      {
        accessorKey: "glam2",
        header: "GLA m²",
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{formatDecimal(row.original.glam2)}</span>
        )
      },
      {
        accessorKey: "tarifaUfM2",
        header: "Tarifa UF/m²",
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {formatDecimal(row.original.tarifaUfM2)}
          </span>
        )
      },
      {
        accessorKey: "rentaFijaUf",
        header: "Renta Fija (UF)",
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {formatDecimal(row.original.rentaFijaUf)}
          </span>
        )
      },
      {
        accessorKey: "ggccUf",
        header: "GGCC (UF)",
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{formatDecimal(row.original.ggccUf)}</span>
        )
      },
      {
        accessorFn: (row) => row.ventasUf ?? undefined,
        id: "ventasUf",
        header: "Ventas (UF)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{renderMetric(row.original.ventasUf)}</span>
        )
      },
      {
        accessorFn: (row) => row.pctRentaVariable ?? undefined,
        id: "pctRentaVariable",
        header: "% Renta Var.",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {renderMetric(row.original.pctRentaVariable, "%")}
          </span>
        )
      },
      {
        accessorFn: (row) => row.rentaVariableUf ?? undefined,
        id: "rentaVariableUf",
        header: "Renta Var. (UF)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {renderMetric(row.original.rentaVariableUf)}
          </span>
        )
      },
      {
        accessorFn: (row) => row.pctFondoPromocion ?? undefined,
        id: "pctFondoPromocion",
        header: "Fondo Prom. %",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {renderMetric(row.original.pctFondoPromocion, "%")}
          </span>
        )
      }
    ],
    []
  );

  const { table } = useDataTable(sortedBaseRows, columns);
  const sortedRows = table.getSortedRowModel().rows.map((row) => row.original);

  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-700">Detalle contractual del snapshot</h3>
          <p className="mt-1 text-xs text-slate-500">
            Contratos ocupados o en gracia vigentes al {snapshotDate}.
          </p>
        </div>
        <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
          Snapshot: {snapshotDate}
        </div>
      </div>
      <DataTable
        table={table}
        emptyMessage={`No hay contratos ocupados o en gracia para el snapshot ${snapshotDate}.`}
        footerContent={
          sortedRows.length > 0 ? (
            <TableRow className="bg-brand-50 font-semibold text-slate-900 hover:bg-brand-50">
              <TableCell className="px-4 py-3 font-semibold" colSpan={2}>
                Totales
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.glam2)}
              </TableCell>
              <TableCell className="px-4 py-3" />
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.rentaFijaUf)}
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.ggccUf)}
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.ventasUf)}
              </TableCell>
              <TableCell className="px-4 py-3" />
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.rentaVariableUf)}
              </TableCell>
              <TableCell className="px-4 py-3" />
            </TableRow>
          ) : null
        }
      />
    </div>
  );
}
