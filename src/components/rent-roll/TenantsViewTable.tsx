"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { numberFilterColumn, statusBadgeColumn } from "@/components/ui/data-table-columns";
import { useDataTable } from "@/hooks/useDataTable";

type TenantsViewRow = {
  id: string;
  rut: string;
  nombreComercial: string;
  vigente: boolean;
  contratosAsociados: number;
  contratosVigentes: number;
  contratosVigentesNumeros: string;
};

type TenantsViewTableProps = {
  rows: TenantsViewRow[];
  detailBaseHref: string;
  selectedDetailId?: string;
  proyectoId: string;
};

const VIGENTE_OPTIONS = ["Si", "No"];

export function TenantsViewTable({
  rows,
  selectedDetailId,
  proyectoId
}: TenantsViewTableProps): JSX.Element {
  const columns = useMemo<ColumnDef<TenantsViewRow, unknown>[]>(
    () => [
      {
        accessorKey: "nombreComercial",
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => (
          <Link
            href={`/tenants/${row.original.id}?project=${proyectoId}`}
            className="text-brand-500 underline underline-offset-2 font-medium transition-colors hover:text-brand-700"
          >
            {row.original.nombreComercial}
          </Link>
        ),
      },
      {
        accessorKey: "rut",
        header: "RUT",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.rut}</span>
      },
      statusBadgeColumn<TenantsViewRow>({
        id: "vigente",
        accessorFn: (row) => (row.vigente ? "Si" : "No"),
        header: "Vigente",
        options: VIGENTE_OPTIONS,
        getValue: (row) => (row.vigente ? "Si" : "No"),
        getClassName: (value) =>
          value === "Si"
            ? "rounded-full border-emerald-200 bg-emerald-100 text-emerald-700"
            : "rounded-full border-slate-200 bg-slate-100 text-slate-700"
      }),
      numberFilterColumn<TenantsViewRow>({
        accessorKey: "contratosAsociados",
        header: "Contratos asociados",
        cell: (row) => <span className="whitespace-nowrap">{row.contratosAsociados}</span>,
        meta: { isNumeric: true },
      }),
      numberFilterColumn<TenantsViewRow>({
        accessorKey: "contratosVigentes",
        header: "Contratos vigentes",
        cell: (row) => <span className="whitespace-nowrap">{row.contratosVigentes}</span>,
        meta: { isNumeric: true },
      }),
      {
        accessorKey: "contratosVigentesNumeros",
        header: "N contrato vigente",
        filterFn: "includesString",
        enableSorting: false,
        cell: ({ row }) => <span>{row.original.contratosVigentesNumeros || "-"}</span>
      }
    ],
    [proyectoId]
  );

  const { table } = useDataTable(rows, columns);

  return (
    <DataTable
      table={table}
      emptyMessage="No se encontraron arrendatarios con contratos activos para los filtros aplicados."
      selectedId={selectedDetailId}
    />
  );
}
