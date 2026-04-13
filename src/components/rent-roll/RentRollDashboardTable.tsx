"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { formatDecimal } from "@/lib/utils";
import { type GapSeverity, getGapSeverity } from "@/lib/shared/gap-utils";

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
  ventasUf: number | null;
  ventasPresupuestadasUf: number | null;
  pctRentaVariable: number | null;
  rentaVariableUf: number | null;
  pctFondoPromocion: number | null;
  facturadoRealUf: number | null;
  brechaUf: number | null;
  brechaPct: number | null;
};

type RentRollDashboardTableProps = {
  rows: RentRollDashboardTableRow[];
  snapshotDate: string;
  proyectoId: string;
  hasAccountingData?: boolean;
};

function renderMetric(value: number | null, suffix = ""): string {
  if (value == null) {
    return "–";
  }
  return `${formatDecimal(value)}${suffix}`;
}

const gapSeverityStyles: Record<GapSeverity, string> = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700 font-semibold"
};

export function RentRollDashboardTable({
  rows,
  snapshotDate,
  proyectoId,
  hasAccountingData = false
}: RentRollDashboardTableProps): JSX.Element {
  const [showBilling, setShowBilling] = useState(false);

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
            path: "/rent-roll/units",
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
            href={`/tenants/${row.original.tenantId}?project=${proyectoId}`}
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
            path: "/rent-roll/contracts",
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
        accessorFn: (row) => row.ventasUf ?? undefined,
        id: "ventasUf",
        header: "Ventas Reales (UF)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: {
          align: "right",
          summary: { type: "sum", formatter: (value: number) => formatDecimal(value) }
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{renderMetric(row.original.ventasUf)}</span>
        )
      },
      {
        accessorFn: (row) => row.ventasPresupuestadasUf ?? undefined,
        id: "ventasPresupuestadasUf",
        header: "Ventas Presup. (UF)",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: {
          align: "right",
          summary: { type: "sum", formatter: (value: number) => formatDecimal(value) }
        },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-slate-700">{renderMetric(row.original.ventasPresupuestadasUf)}</span>
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
      ...(showBilling
        ? [
            {
              accessorFn: (row: RentRollDashboardTableRow) => row.facturadoRealUf ?? undefined,
              id: "facturadoRealUf",
              header: "Facturado Real (UF)",
              enableColumnFilter: false,
              sortUndefined: "last",
              meta: {
                align: "right" as const,
                summary: { type: "sum" as const, formatter: (value: number) => formatDecimal(value) }
              },
              cell: ({ row }: { row: { original: RentRollDashboardTableRow } }) => (
                <span className="whitespace-nowrap text-slate-700">
                  {renderMetric(row.original.facturadoRealUf)}
                </span>
              )
            } satisfies ColumnDef<RentRollDashboardTableRow, unknown>,
            {
              accessorFn: (row: RentRollDashboardTableRow) => row.brechaUf ?? undefined,
              id: "brechaUf",
              header: "Brecha (UF)",
              enableColumnFilter: false,
              sortUndefined: "last",
              meta: {
                align: "right" as const,
                summary: { type: "sum" as const, formatter: (value: number) => formatDecimal(value) }
              },
              cell: ({ row }: { row: { original: RentRollDashboardTableRow } }) => {
                const { brechaUf, brechaPct } = row.original;
                if (brechaUf == null) return <span className="text-slate-400">–</span>;
                const severity = getGapSeverity(brechaPct ?? 0);
                return (
                  <span className={`whitespace-nowrap ${gapSeverityStyles[severity]}`}>
                    {formatDecimal(brechaUf)} ({formatDecimal(brechaPct ?? 0)}%)
                  </span>
                );
              }
            } satisfies ColumnDef<RentRollDashboardTableRow, unknown>
          ]
        : [])
    ],
    [proyectoId, showBilling]
  );

  const { table } = useDataTable(sortedBaseRows, columns);

  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-700">Detalle contractual del snapshot</h3>
          <p className="mt-1 text-xs text-slate-500">
            Contratos ocupados o en gracia vigentes al {snapshotDate}.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {hasAccountingData && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showBilling}
                onChange={(e) => setShowBilling(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              Mostrar facturacion real
            </label>
          )}
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
