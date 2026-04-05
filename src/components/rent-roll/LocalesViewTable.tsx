"use client";

import Link from "next/link";
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { formatDecimal } from "@/lib/utils";

type LocalesViewRow = {
  id: string;
  codigo: string;
  tipo: string;
  piso: string;
  zona: string | null;
  glam2: string;
  esGLA: boolean;
  estado: "ACTIVO" | "INACTIVO";
};

type LocalesViewTableProps = {
  rows: LocalesViewRow[];
  buildDetailHref: (id: string | null) => string;
};

const SI_NO_OPTIONS = ["Si", "No"];
const ESTADO_OPTIONS = ["ACTIVO", "INACTIVO"];

function toNumber(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function LocalesViewTable({ rows, buildDetailHref }: LocalesViewTableProps): JSX.Element {
  const tipoOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.tipo))).sort(),
    [rows]
  );
  const columns = useMemo<ColumnDef<LocalesViewRow, unknown>[]>(
    () => [
      {
        accessorKey: "codigo",
        header: "Codigo",
        filterFn: "includesString",
        cell: ({ row }) => (
          <Link href={buildDetailHref(row.original.id)} className="font-medium text-brand-700 underline">
            {row.original.codigo}
          </Link>
        )
      },
      {
        accessorKey: "tipo",
        header: "Tipo",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: tipoOptions },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.tipo}</span>
      },
      {
        accessorKey: "piso",
        header: "Piso",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.piso}</span>
      },
      {
        accessorKey: "zona",
        header: "Zona",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.zona ?? "-"}</span>
      },
      {
        id: "glam2",
        accessorFn: (row) => toNumber(row.glam2),
        header: "GLA m2",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDecimal(row.original.glam2)}</span>
      },
      {
        id: "esGLA",
        accessorFn: (row) => (row.esGLA ? "Si" : "No"),
        header: "Es GLA",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: SI_NO_OPTIONS, align: "center" },
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.esGLA
                ? "rounded-full border-emerald-200 bg-emerald-100 text-emerald-700"
                : "rounded-full border-slate-200 bg-slate-100 text-slate-700"
            }
          >
            {row.original.esGLA ? "Si" : "No"}
          </Badge>
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
        meta: { filterType: "enum", filterOptions: ESTADO_OPTIONS, align: "center" },
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.estado === "ACTIVO"
                ? "rounded-full border-brand-200 bg-brand-100 text-brand-700"
                : "rounded-full border-slate-300 bg-slate-200 text-slate-700"
            }
          >
            {row.original.estado}
          </Badge>
        )
      }
    ],
    [buildDetailHref, tipoOptions]
  );

  const { table } = useDataTable(rows, columns);

  return <DataTable table={table} emptyMessage="No se encontraron locales para los filtros aplicados." />;
}
