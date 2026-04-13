"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { formatDateString } from "@/lib/utils";

type ContractsViewRow = {
  id: string;
  numeroContrato: string;
  locales: string;
  arrendatario: string;
  arrendatarioId: string;
  estado: string;
  fechaInicio: string;
  fechaTermino: string;
  pdfUrl: string | null;
};

type ContractsViewTableProps = {
  rows: ContractsViewRow[];
  proyectoId: string;
};

const PDF_OPTIONS = ["Disponible", "Sin PDF"];

export function ContractsViewTable({
  rows,
  proyectoId
}: ContractsViewTableProps): JSX.Element {
  const stateOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.estado))).sort(),
    [rows]
  );

  const columns = useMemo<ColumnDef<ContractsViewRow, unknown>[]>(
    () => [
      {
        accessorKey: "numeroContrato",
        header: "N contrato",
        filterFn: "includesString",
        cell: ({ row }) => (
          <Link
            href={`/rent-roll/contracts/${row.original.id}?project=${proyectoId}`}
            className="whitespace-nowrap font-medium text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
          >
            {row.original.numeroContrato}
          </Link>
        ),
      },
      {
        accessorKey: "locales",
        header: "Locales",
        filterFn: "includesString",
        cell: ({ row }) => <span>{row.original.locales}</span>
      },
      {
        accessorKey: "arrendatario",
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => (
          <Link
            href={`/tenants/${row.original.arrendatarioId}?project=${proyectoId}`}
            className="whitespace-nowrap text-brand-500 underline underline-offset-2 font-medium transition-colors hover:text-brand-700"
          >
            {row.original.arrendatario}
          </Link>
        )
      },
      {
        accessorKey: "estado",
        header: "Estado",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: stateOptions, align: "center" },
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="rounded-full border-brand-200 bg-brand-100 text-brand-700"
          >
            {row.original.estado}
          </Badge>
        )
      },
      {
        accessorKey: "fechaInicio",
        header: "Inicio",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDateString(row.original.fechaInicio)}</span>
      },
      {
        accessorKey: "fechaTermino",
        header: "Termino",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDateString(row.original.fechaTermino)}</span>
      },
      {
        id: "pdf",
        accessorFn: (row) => (row.pdfUrl ? "Disponible" : "Sin PDF"),
        header: "PDF",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: PDF_OPTIONS, align: "center" },
        cell: ({ row }) => <span>{row.original.pdfUrl ? "Disponible" : "Sin PDF"}</span>
      }
    ],
    [stateOptions, proyectoId]
  );

  const { table } = useDataTable(rows, columns);

  return (
    <DataTable
      table={table}
      emptyMessage="Aun no hay contratos en este proyecto."
    />
  );
}
