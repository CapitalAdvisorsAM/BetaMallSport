"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { formatClp, formatDecimal, formatUfPerM2 } from "@/lib/utils";

export type RentRollDashboardTableRow = {
  id: string; // Contract ID
  localId: string; // Unit ID
  tenantId: string; // Tenant ID
  local: string;
  arrendatario: string;
  glam2: number;
  tarifaUfM2: number;
  rentaFijaUf: number;
  ggccUf: number;
  ventasPesos: number | null;
  ventasPresupuestadasPesos: number | null;
  pctRentaVariable: number | null;
  rentaVariableUf: number | null;
  pctFondoPromocion: number | null;
};

type RentRollDashboardTableProps = {
  rows: RentRollDashboardTableRow[];
  snapshotDate: string;
};

function renderMetric(value: number | null, suffix = ""): string {
  if (value == null) {
    return "–";
  }
  return `${formatDecimal(value)}${suffix}`;
}

export function RentRollDashboardTable({
  rows,
  snapshotDate
}: RentRollDashboardTableProps): JSX.Element {
  const sortedBaseRows = useMemo(
    () => [...rows].sort((a, b) => a.local.localeCompare(b.local, "es-CL")),
    [rows]
  );

  const columns = useMemo<ColumnDef<RentRollDashboardTableRow, unknown>[]>(
    () => [
      {
        accessorKey: "local",
        header: "Local",
        filterFn: "includesString",
        meta: {
          linkTo: {
            path: "/plan/units",
            idKey: "localId",
          },
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium text-slate-900">{row.original.local}</span>
        )
      },
      {
        accessorKey: "arrendatario",
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => (
          <Link
            href={`/tenants/${row.original.tenantId}`}
            className="whitespace-nowrap text-brand-500 underline underline-offset-2 font-medium transition-colors hover:text-brand-700"
          >
            {row.original.arrendatario}
          </Link>
        )
      },
      {
        id: "contractId",
        header: "Contrato",
        accessorFn: (row) => row.id,
        meta: {
          linkTo: {
            path: "/plan/contracts",
            idKey: "id",
          },
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-slate-500">
            {row.original.id.slice(0, 8)}...
          </span>
        )
      },
      {
        accessorKey: "glam2",
        header: "GLA (m²)",
        enableColumnFilter: false,
        meta: {
          align: "right",
          summary: { type: "sum", formatter: (value: number) => formatDecimal(value) }
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{formatDecimal(row.original.glam2)}</span>
        )
      },
      {
        accessorKey: "tarifaUfM2",
        header: "Tarifa (UF/m²)",
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {formatDecimal(row.original.tarifaUfM2)}
          </span>
        )
      },
      {
        accessorKey: "rentaFijaUf",
        header: "Renta Fija (UF)",
        enableColumnFilter: false,
        meta: {
          align: "right",
          summary: { type: "sum", formatter: (value: number) => formatDecimal(value) }
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {formatDecimal(row.original.rentaFijaUf)}
          </span>
        )
      },
      {
        accessorKey: "ggccUf",
        header: "GGCC (UF)",
        enableColumnFilter: false,
        meta: {
          align: "right",
          summary: { type: "sum", formatter: (value: number) => formatDecimal(value) }
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{formatDecimal(row.original.ggccUf)}</span>
        )
      },
      {
        accessorFn: (row) => row.ventasPesos ?? undefined,
        id: "ventasPesos",
        header: "Ventas Reales (Pesos)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: {
          align: "right",
          summary: { type: "sum", formatter: (value: number) => formatClp(value) }
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {row.original.ventasPesos != null ? formatClp(row.original.ventasPesos) : "–"}
          </span>
        )
      },
      {
        accessorFn: (row) => row.ventasPresupuestadasPesos ?? undefined,
        id: "ventasPresupuestadasPesos",
        header: "Ventas Presup. (Pesos)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: {
          align: "right",
          summary: { type: "sum", formatter: (value: number) => formatClp(value) }
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {row.original.ventasPresupuestadasPesos != null ? formatClp(row.original.ventasPresupuestadasPesos) : "–"}
          </span>
        )
      },
      {
        accessorFn: (row) => row.pctRentaVariable ?? undefined,
        id: "pctRentaVariable",
        header: "Renta Var. (%)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {renderMetric(row.original.pctRentaVariable, "")}
          </span>
        )
      },
      {
        accessorFn: (row) => row.rentaVariableUf ?? undefined,
        id: "rentaVariableUf",
        header: "Renta Var. (UF)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: {
          align: "right",
          summary: { type: "sum", formatter: (value: number) => formatDecimal(value) }
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {renderMetric(row.original.rentaVariableUf)}
          </span>
        )
      },
      {
        accessorFn: (row) => row.pctFondoPromocion ?? undefined,
        id: "pctFondoPromocion",
        header: "Fondo Prom. (%)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">
            {renderMetric(row.original.pctFondoPromocion, "")}
          </span>
        )
      },
    ],
    []
  );

  const { table } = useDataTable(sortedBaseRows, columns);

  const weightedAvgUfM2 = useMemo(() => {
    const totalGla = rows.reduce((sum, r) => sum + r.glam2, 0);
    if (totalGla === 0) return null;
    return rows.reduce((sum, r) => sum + r.tarifaUfM2 * r.glam2, 0) / totalGla;
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-700">Detalle contractual del snapshot</h3>
          <p className="mt-1 text-xs text-slate-500">
            Contratos ocupados o en gracia vigentes al {snapshotDate}.
            {weightedAvgUfM2 !== null && (
              <> · Tarifa ponderada: <span className="font-medium text-slate-700">{formatUfPerM2(weightedAvgUfM2)} UF/m²</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
            Snapshot: {snapshotDate}
          </div>
        </div>
      </div>
      <DataTable
        table={table}
        emptyMessage={`No hay contratos ocupados o en gracia para el snapshot ${snapshotDate}.`}
        summaryRow={{ enabled: true, label: "Totales" }}
      />
    </div>
  );
}
