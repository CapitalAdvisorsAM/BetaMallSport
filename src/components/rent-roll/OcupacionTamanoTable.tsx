"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { formatDecimal } from "@/lib/utils";

type OcupacionTamanoRow = {
  tipo: string;
  glaTotal: number;
  glaArrendada: number;
  vacante: number;
  pctVacancia: number;
};

type OcupacionTamanoTableProps = {
  rows: OcupacionTamanoRow[];
};

export function OcupacionTamanoTable({ rows }: OcupacionTamanoTableProps): JSX.Element {
  const columns = useMemo<ColumnDef<OcupacionTamanoRow, unknown>[]>(
    () => [
      {
        accessorKey: "tipo",
        header: "Tipo",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap font-medium">{row.original.tipo}</span>
      },
      {
        accessorKey: "glaTotal",
        header: "GLA Total",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDecimal(row.original.glaTotal)}</span>
      },
      {
        accessorKey: "glaArrendada",
        header: "GLA Arrendada",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDecimal(row.original.glaArrendada)}</span>
      },
      {
        accessorKey: "vacante",
        header: "Vacante",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDecimal(row.original.vacante)}</span>
      },
      {
        accessorKey: "pctVacancia",
        header: "% Vacancia",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDecimal(row.original.pctVacancia)}%</span>
      }
    ],
    []
  );

  const { table } = useDataTable(rows, columns);

  return <DataTable table={table} emptyMessage="No hay datos de ocupacion para mostrar." />;
}
