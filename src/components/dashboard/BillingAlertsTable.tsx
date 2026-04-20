"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { formatPercent } from "@/lib/utils";

export type BillingAlertRow = {
  id: string;
  severity: "CRITICAL" | "WARNING";
  consecutiveMonths: number;
  avgGapPct: number;
  latestPeriod: string;
  arrendatarioId: string;
  arrendatarioNombre: string;
};

export function BillingAlertsTable({ rows }: { rows: BillingAlertRow[] }): JSX.Element {
  const columns = useMemo<ColumnDef<BillingAlertRow, unknown>[]>(
    () => [
      {
        accessorKey: "arrendatarioNombre",
        header: "Arrendatario",
        meta: { filterType: "text" },
        cell: ({ row }) => (
          <Link
            href={`/tenants/${row.original.arrendatarioId}`}
            className="font-medium text-brand-500 underline underline-offset-2 hover:text-brand-700"
          >
            {row.original.arrendatarioNombre}
          </Link>
        ),
      },
      {
        accessorKey: "severity",
        header: "Severidad",
        meta: { filterType: "enum", filterOptions: ["CRITICAL", "WARNING"], align: "center" },
        cell: ({ getValue }) => {
          const severity = getValue<"CRITICAL" | "WARNING">();
          return (
            <span
              className={
                severity === "CRITICAL"
                  ? "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700"
                  : "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700"
              }
            >
              {severity === "CRITICAL" ? "Crítico" : "Alerta"}
            </span>
          );
        },
      },
      {
        accessorKey: "consecutiveMonths",
        header: "Meses",
        meta: { filterType: "number", align: "right" },
        cell: ({ getValue }) => (
          <span className="tabular-nums text-slate-600">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "avgGapPct",
        header: "Brecha Prom.",
        meta: { filterType: "number", align: "right" },
        cell: ({ getValue }) => (
          <span className="tabular-nums font-semibold text-rose-600">
            {formatPercent(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "latestPeriod",
        header: "Último Periodo",
        meta: { filterType: "string" },
        cell: ({ getValue }) => (
          <span className="tabular-nums text-slate-600">{getValue<string>()}</span>
        ),
      },
    ],
    [],
  );

  const { table } = useDataTable(rows, columns);

  return <DataTable table={table} emptyMessage="Sin alertas activas." density="compact" />;
}
