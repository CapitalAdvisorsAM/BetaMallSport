"use client";

import Link from "next/link";
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";

type ArrendatariosViewRow = {
  id: string;
  rut: string;
  nombreComercial: string;
  vigente: boolean;
  contratosAsociados: number;
  contratosVigentes: number;
  contratosVigentesNumeros: string;
};

type ArrendatariosViewTableProps = {
  rows: ArrendatariosViewRow[];
  buildDetailHref: (id: string | null) => string;
};

const VIGENTE_OPTIONS = ["Si", "No"];

export function ArrendatariosViewTable({
  rows,
  buildDetailHref
}: ArrendatariosViewTableProps): JSX.Element {
  const columns = useMemo<ColumnDef<ArrendatariosViewRow, unknown>[]>(
    () => [
      {
        accessorKey: "nombreComercial",
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => (
          <Link href={buildDetailHref(row.original.id)} className="font-medium text-brand-700 underline">
            {row.original.nombreComercial}
          </Link>
        )
      },
      {
        accessorKey: "rut",
        header: "RUT",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.rut}</span>
      },
      {
        id: "vigente",
        accessorFn: (row) => (row.vigente ? "Si" : "No"),
        header: "Vigente",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: VIGENTE_OPTIONS, align: "center" },
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.vigente
                ? "rounded-full border-emerald-200 bg-emerald-100 text-emerald-700"
                : "rounded-full border-slate-200 bg-slate-100 text-slate-700"
            }
          >
            {row.original.vigente ? "Si" : "No"}
          </Badge>
        )
      },
      {
        accessorKey: "contratosAsociados",
        header: "Contratos asociados",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.contratosAsociados}</span>
      },
      {
        accessorKey: "contratosVigentes",
        header: "Contratos vigentes (periodo)",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.contratosVigentes}</span>
      },
      {
        accessorKey: "contratosVigentesNumeros",
        header: "N contrato vigente",
        filterFn: "includesString",
        enableSorting: false,
        cell: ({ row }) => <span>{row.original.contratosVigentesNumeros || "-"}</span>
      }
    ],
    [buildDetailHref]
  );

  const { table } = useDataTable(rows, columns);

  return (
    <DataTable
      table={table}
      emptyMessage="No se encontraron arrendatarios con contratos activos para los filtros aplicados."
    />
  );
}
