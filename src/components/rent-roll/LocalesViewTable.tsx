"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import {
  enumFilterColumn,
  linkColumn,
  numberFilterColumn,
  statusBadgeColumn
} from "@/components/ui/data-table-columns";
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
  detailBaseHref: string;
  selectedDetailId?: string;
};

const SI_NO_OPTIONS = ["Si", "No"];
const ESTADO_OPTIONS = ["ACTIVO", "INACTIVO"];

function toNumber(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function LocalesViewTable({ rows, detailBaseHref, selectedDetailId }: LocalesViewTableProps): JSX.Element {
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
        meta: {
          linkTo: {
            triggerDetail: true,
          },
        },
      },
      enumFilterColumn<LocalesViewRow>({
        accessorKey: "tipo",
        header: "Tipo",
        options: tipoOptions,
        cell: (row) => <span className="whitespace-nowrap">{row.tipo}</span>
      }),
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
      numberFilterColumn<LocalesViewRow>({
        id: "glam2",
        accessorFn: (row) => toNumber(row.glam2),
        header: "GLA (m²)",
        cell: (row) => <span className="whitespace-nowrap">{formatDecimal(row.glam2)}</span>,
        meta: { isNumeric: true },
      }),
      statusBadgeColumn<LocalesViewRow>({
        id: "esGLA",
        accessorFn: (row) => (row.esGLA ? "Si" : "No"),
        header: "Es GLA",
        options: SI_NO_OPTIONS,
        getValue: (row) => (row.esGLA ? "Si" : "No"),
        getClassName: (value) =>
          value === "Si"
            ? "rounded-full border-emerald-200 bg-emerald-100 text-emerald-700"
            : "rounded-full border-slate-200 bg-slate-100 text-slate-700"
      }),
      statusBadgeColumn<LocalesViewRow>({
        accessorKey: "estado",
        header: "Estado",
        options: ESTADO_OPTIONS,
        getValue: (row) => row.estado,
        getClassName: (value) =>
          value === "ACTIVO"
            ? "rounded-full border-brand-200 bg-brand-100 text-brand-700"
            : "rounded-full border-slate-300 bg-slate-200 text-slate-700"
      })
    ],
    [detailBaseHref, tipoOptions]
  );

  const { table } = useDataTable(rows, columns);

  return <DataTable table={table} emptyMessage="No se encontraron locales para los filtros aplicados." selectedId={selectedDetailId} />;
}
