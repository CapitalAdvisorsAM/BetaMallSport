"use client";

import Link from "next/link";
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { formatShortDate, type ContractExpiryRow } from "@/lib/kpi";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";

type ContractExpiryTableProps = {
  rows: ContractExpiryRow[];
  proyectoId: string;
};

type UrgencyBadge = {
  className: string;
  label: string;
};

const CONTRACT_EXPIRY_EXECUTIVE_LIMIT = 5;

function getUrgencyBadge(diasRestantes: number): UrgencyBadge {
  if (diasRestantes <= 7) {
    return {
      className: "bg-rose-100 text-rose-800",
      label: "Vence esta semana"
    };
  }
  if (diasRestantes <= 30) {
    return {
      className: "bg-rose-50 text-rose-700",
      label: `${diasRestantes} dias`
    };
  }
  if (diasRestantes <= 60) {
    return {
      className: "bg-amber-50 text-amber-700",
      label: `${diasRestantes} dias`
    };
  }
  return {
    className: "bg-orange-50 text-orange-700",
    label: `${diasRestantes} dias`
  };
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

export function ContractExpiryTable({ rows, proyectoId }: ContractExpiryTableProps): JSX.Element {
  const rowsSorted = [...rows].sort((left, right) => left.diasRestantes - right.diasRestantes);
  const visibleRows = rowsSorted.slice(0, CONTRACT_EXPIRY_EXECUTIVE_LIMIT);
  const totalCount = rowsSorted.length;
  const urgentCount = Math.min(totalCount, CONTRACT_EXPIRY_EXECUTIVE_LIMIT);
  const href = "/rent-roll/dashboard";
  const columns = useMemo<ColumnDef<ContractExpiryRow, unknown>[]>(
    () => [
      {
        accessorKey: "local",
        header: "Local",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap font-medium text-slate-900">{row.original.local}</span>
      },
      {
        accessorKey: "arrendatario",
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap text-slate-700">{row.original.arrendatario}</span>
      },
      {
        accessorKey: "numeroContrato",
        header: "Numero Contrato",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap text-slate-700">{row.original.numeroContrato}</span>
      },
      {
        id: "fechaTermino",
        accessorFn: (row) => toDate(row.fechaTermino).getTime(),
        header: "Fecha Termino",
        enableColumnFilter: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{formatShortDate(toDate(row.original.fechaTermino))}</span>
        )
      },
      {
        accessorKey: "diasRestantes",
        header: "Dias Restantes",
        filterFn: "inNumberRange",
        meta: { filterType: "number", align: "center" },
        cell: ({ row }) => {
          const badge = getUrgencyBadge(row.original.diasRestantes);
          return (
            <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold", badge.className)}>
              {badge.label}
            </span>
          );
        }
      }
    ],
    []
  );
  const { table } = useDataTable(visibleRows, columns);

  return (
    <section className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-brand-700">Proximos vencimientos</h3>
        <p className="mt-1 text-sm text-slate-600">Los {urgentCount} mas urgentes - Actua antes para evitar vacancia</p>
      </div>

      <DataTable table={table} emptyMessage="No hay contratos proximos a vencer en los proximos 90 dias." />

      <div className="border-t border-slate-200 px-4 py-3 text-right text-sm">
        {totalCount > CONTRACT_EXPIRY_EXECUTIVE_LIMIT ? (
          <span className="mr-2 text-slate-500">
            Mostrando {CONTRACT_EXPIRY_EXECUTIVE_LIMIT} de {totalCount}.
          </span>
        ) : null}
        <Link href={href} className="text-brand-500 underline hover:text-brand-700">
          Ver todos los vencimientos en Rent Roll -&gt;
        </Link>
      </div>
    </section>
  );
}
