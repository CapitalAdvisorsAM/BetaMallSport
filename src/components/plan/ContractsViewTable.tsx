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
  cuentaParaVacancia: boolean;
};

type ContractsViewTableProps = {
  rows: ContractsViewRow[];
};

const PDF_OPTIONS = ["Disponible", "Sin PDF"];
const VACANCIA_OPTIONS = ["Si", "No"];

export function ContractsViewTable({
  rows
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
            href={`/plan/contracts/${row.original.id}`}
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
            href={`/tenants/${row.original.arrendatarioId}`}
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
      },
      {
        id: "cuentaParaVacancia",
        accessorFn: (row) => (row.cuentaParaVacancia ? "Si" : "No"),
        header: "Vacancia",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: VACANCIA_OPTIONS, align: "center" },
        cell: ({ row }) =>
          row.original.cuentaParaVacancia ? (
            <span className="text-slate-700">Si</span>
          ) : (
            <Badge
              variant="outline"
              title="Este contrato existe y se cobra, pero el local no se cuenta como ocupado en los KPIs de vacancia."
              className="rounded-full border-amber-200 bg-amber-50 text-amber-700"
            >
              No
            </Badge>
          )
      }
    ],
    [stateOptions]
  );

  const { table } = useDataTable(rows, columns);

  return (
    <DataTable
      table={table}
      emptyMessage="Aun no hay contratos en este proyecto."
    />
  );
}
