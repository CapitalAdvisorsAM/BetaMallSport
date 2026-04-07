"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { numberFilterColumn, statusBadgeColumn } from "@/components/ui/data-table-columns";
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
  detailBaseHref: string;
  selectedDetailId?: string;
};

const VIGENTE_OPTIONS = ["Si", "No"];

export function ArrendatariosViewTable({
  rows,
  selectedDetailId
}: ArrendatariosViewTableProps): JSX.Element {
  const columns = useMemo<ColumnDef<ArrendatariosViewRow, unknown>[]>(
    () => [
      {
        accessorKey: "nombreComercial",
        header: "Arrendatario",
        filterFn: "includesString",
        meta: {
          linkTo: {
            triggerDetail: true,
          },
        },
      },
      {
        accessorKey: "rut",
        header: "RUT",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.rut}</span>
      },
      statusBadgeColumn<ArrendatariosViewRow>({
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
      numberFilterColumn<ArrendatariosViewRow>({
        accessorKey: "contratosAsociados",
        header: "Contratos asociados",
        cell: (row) => <span className="whitespace-nowrap">{row.contratosAsociados}</span>,
        meta: { isNumeric: true },
      }),
      numberFilterColumn<ArrendatariosViewRow>({
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
    []
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
