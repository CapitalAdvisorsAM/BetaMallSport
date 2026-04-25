"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { formatDecimal } from "@/lib/utils";

type OcupacionTipoRow = {
  categoria: string;
  glaTotal: number;
  glaArrendada: number;
  vacante: number;
  pctDelTotal: number;
  pctVacancia: number;
};

type OcupacionTipoTableProps = {
  rows: OcupacionTipoRow[];
};

export function OcupacionTipoTable({ rows }: OcupacionTipoTableProps): JSX.Element {
  const columns = useMemo<ColumnDef<OcupacionTipoRow, unknown>[]>(
    () => [
      {
        accessorKey: "categoria",
        header: "Categoria",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap font-medium">{row.original.categoria}</span>
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
        accessorKey: "pctDelTotal",
        header: "% del Total",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDecimal(row.original.pctDelTotal)}%</span>
      },
      {
        accessorKey: "pctVacancia",
        header: "% Vacancia",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => {
          const pct = row.original.pctVacancia;
          const color = pct > 20 ? "text-rose-600" : pct > 0 ? "text-amber-600" : "text-emerald-600";
          return <span className={`whitespace-nowrap font-medium ${color}`}>{formatDecimal(pct)}%</span>;
        }
      }
    ],
    []
  );

  const { table } = useDataTable(rows, columns);

  return <DataTable table={table} emptyMessage="No hay datos de ocupacion por categoria." />;
}
