"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";

type CargaHistorialItem = {
  id: string;
  createdAt: Date | string;
  archivoNombre?: string;
  fileName?: string;
  estado?: string;
  status?: string;
  created: number;
  updated: number;
  rejected: number;
};

type CargaHistorialProps = {
  items: CargaHistorialItem[];
  title?: string;
  errorDownloadBasePath?: string | null;
  countLabels?: {
    created: string;
    updated: string;
    rejected: string;
  };
};

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short"
});

const estadoMeta: Record<string, { label: string; className: string }> = {
  OK: { label: "OK", className: "border-emerald-200 bg-emerald-100 text-emerald-800" },
  ERROR: { label: "ERROR", className: "border-rose-200 bg-rose-100 text-rose-800" },
  PROCESANDO: { label: "PROCESANDO", className: "border-blue-200 bg-blue-100 text-blue-800" },
  PROCESSING: { label: "PROCESANDO", className: "border-blue-200 bg-blue-100 text-blue-800" },
  PENDIENTE: { label: "PENDIENTE", className: "border-amber-200 bg-amber-100 text-amber-800" },
  PENDING: { label: "PENDIENTE", className: "border-amber-200 bg-amber-100 text-amber-800" }
};

function toDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

function getFileName(item: CargaHistorialItem): string {
  return item.fileName ?? item.archivoNombre ?? "-";
}

function getStatus(item: CargaHistorialItem): string {
  return item.status ?? item.estado ?? "";
}

function EstadoBadge({ estado }: { estado: string }): JSX.Element {
  const meta = estadoMeta[estado] ?? {
    label: estado,
    className: "border-slate-200 bg-slate-100 text-slate-700"
  };

  return (
    <Badge variant="outline" className={`rounded-md px-2 py-0.5 ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

export function CargaHistorial({
  items,
  title = "Ultimas 5 cargas",
  errorDownloadBasePath = "/api/rent-roll/upload/errors",
  countLabels = {
    created: "Creados",
    updated: "Actualizados",
    rejected: "Errores"
  }
}: CargaHistorialProps): JSX.Element {
  const columns = useMemo<ColumnDef<CargaHistorialItem, unknown>[]>(
    () => [
      {
        id: "createdAt",
        accessorFn: (row) => toDate(row.createdAt).getTime(),
        header: "Fecha",
        enableColumnFilter: false,
        meta: { align: "left" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-600">{dateFormatter.format(toDate(row.original.createdAt))}</span>
        )
      },
      {
        id: "archivo",
        accessorFn: (row) => getFileName(row),
        header: "Archivo",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="block max-w-[220px] truncate text-slate-700" title={getFileName(row.original)}>
            {getFileName(row.original)}
          </span>
        )
      },
      {
        id: "estado",
        accessorFn: (row) => getStatus(row),
        header: "Estado",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: {
          filterType: "enum",
          filterOptions: Object.keys(estadoMeta),
          align: "center"
        },
        cell: ({ row }) => <EstadoBadge estado={getStatus(row.original)} />
      },
      {
        accessorKey: "created",
        header: countLabels.created,
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) =>
          row.original.created > 0 ? (
            <span className="font-semibold text-emerald-700">{row.original.created}</span>
          ) : (
            <span className="text-slate-400">0</span>
          )
      },
      {
        accessorKey: "updated",
        header: countLabels.updated,
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) =>
          row.original.updated > 0 ? (
            <span className="font-semibold text-amber-700">{row.original.updated}</span>
          ) : (
            <span className="text-slate-400">0</span>
          )
      },
      {
        accessorKey: "rejected",
        header: countLabels.rejected,
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "right" },
        cell: ({ row }) =>
          row.original.rejected > 0 ? (
            <span className="font-semibold text-rose-700">{row.original.rejected}</span>
          ) : (
            <span className="text-slate-400">0</span>
          )
      },
      {
        id: "detalle",
        accessorFn: (row) =>
          row.rejected > 0 && errorDownloadBasePath
            ? "Descargar errores"
            : getStatus(row) === "PENDIENTE" || getStatus(row) === "PENDING"
              ? "Preview sin aplicar"
              : "-",
        header: "Detalle",
        filterFn: "includesString",
        cell: ({ row }) =>
          row.original.rejected > 0 && errorDownloadBasePath ? (
            <a
              href={`${errorDownloadBasePath}?cargaId=${row.original.id}`}
              className="text-xs font-medium text-brand-700 underline hover:text-brand-500"
            >
              Descargar errores
            </a>
          ) : getStatus(row.original) === "PENDIENTE" || getStatus(row.original) === "PENDING" ? (
            <span className="text-xs text-amber-600">Preview sin aplicar</span>
          ) : (
            <span className="text-xs text-slate-400">-</span>
          )
      }
    ],
    [countLabels.created, countLabels.rejected, countLabels.updated, errorDownloadBasePath]
  );
  const { table } = useDataTable(items, columns);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Aun no hay cargas registradas para este tipo.</p>
      ) : (
        <div className="mt-3">
          <DataTable table={table} getRowClassName={() => "hover:bg-slate-50"} />
        </div>
      )}
    </section>
  );
}
