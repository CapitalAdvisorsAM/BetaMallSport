"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import { useDataTable } from "@/hooks/useDataTable";
import type { ContractManagerListItem } from "@/types";

type ContractListProps = {
  contracts: ContractManagerListItem[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  nextCursor?: string;
  onLoadMore: () => void;
  selectedId?: string | null;
  deletingId?: string | null;
};

function toDateLabel(value: string): string {
  return value.slice(0, 10);
}

export function ContractList({
  contracts,
  onEdit,
  onDelete,
  canEdit,
  nextCursor,
  onLoadMore,
  selectedId,
  deletingId
}: ContractListProps): JSX.Element {
  const [search, setSearch] = useState("");

  const visibleContracts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      return contracts;
    }

    return contracts.filter((contract) =>
      [
        contract.numeroContrato,
        (contract.locales.length > 0 ? contract.locales : [contract.local])
          .map((local) => local.codigo)
          .join(" "),
        contract.arrendatario.nombreComercial
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [contracts, search]);
  const stateOptions = useMemo(
    () => Array.from(new Set(contracts.map((contract) => contract.estado))).sort(),
    [contracts]
  );
  const columns = useMemo<ColumnDef<ContractManagerListItem, unknown>[]>(
    () => [
      {
        accessorKey: "numeroContrato",
        header: "Contrato",
        filterFn: "includesString",
        cell: ({ row }) => <span className="font-medium text-slate-900">{row.original.numeroContrato}</span>
      },
      {
        id: "locales",
        accessorFn: (row) =>
          (row.locales.length > 0 ? row.locales : [row.local]).map((local) => local.codigo).join(", "),
        header: "Locales",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="text-slate-700">
            {(row.original.locales.length > 0 ? row.original.locales : [row.original.local])
              .map((local) => local.codigo)
              .join(", ")}
          </span>
        )
      },
      {
        id: "arrendatario",
        accessorFn: (row) => row.arrendatario.nombreComercial,
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-slate-700">{row.original.arrendatario.nombreComercial}</span>
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
          <Badge variant="outline" className="border-brand-200 bg-brand-100 text-brand-700">
            {row.original.estado}
          </Badge>
        )
      },
      {
        accessorKey: "fechaInicio",
        header: "Inicio",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-slate-700">{toDateLabel(row.original.fechaInicio)}</span>
      },
      {
        accessorKey: "fechaTermino",
        header: "Termino",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-slate-700">{toDateLabel(row.original.fechaTermino)}</span>
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
        meta: { filterType: "enum", filterOptions: ["Disponible", "Sin PDF"], align: "center" },
        cell: ({ row }) =>
          row.original.pdfUrl ? (
            <a
              href={row.original.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-brand-700 underline"
            >
              Ver PDF
            </a>
          ) : (
            <span className="text-xs text-slate-500">Sin PDF</span>
          )
      },
      {
        id: "acciones",
        accessorFn: (row) => row.id,
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onEdit(row.original.id)}
              className="h-auto px-2 py-1 text-xs"
            >
              Editar
            </Button>
            {canEdit ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDelete(row.original.id)}
                disabled={deletingId === row.original.id}
                className="h-auto px-2 py-1 text-xs"
              >
                {deletingId === row.original.id ? "Eliminando..." : "Eliminar"}
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    [canEdit, deletingId, onDelete, onEdit, stateOptions]
  );
  const { table } = useDataTable(visibleContracts, columns);

  return (
    <section className="rounded-md bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Contratos del proyecto</h3>
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Buscar contrato/local"
          className="w-full md:w-64"
        />
      </div>

      <div className="mt-3">
        <DataTable
          table={table}
          emptyMessage="No hay contratos para mostrar."
          getRowClassName={(row) =>
            selectedId === row.original.id ? "bg-brand-50 hover:bg-brand-50" : undefined
          }
        />
      </div>

      {nextCursor ? (
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" onClick={onLoadMore}>
            Cargar mas
          </Button>
        </div>
      ) : null}
    </section>
  );
}
