"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/DataTable";
import { statusBadgeColumn } from "@/components/ui/data-table-columns";
import { TableDisclosureButton } from "@/components/ui/TableDisclosureButton";
import { useDataTable } from "@/hooks/useDataTable";
import { TenantContractSubRow, type ContractDetail } from "@/components/plan/TenantContractSubRow";

type TenantsViewRow = {
  id: string;
  rut: string;
  nombreComercial: string;
  vigente: boolean;
  contratosAsociados: number;
  contratosVigentes: number;
  contratosVigentesNumeros: string;
  contratos: ContractDetail[];
};

type TenantsViewTableProps = {
  rows: TenantsViewRow[];
  detailBaseHref: string;
  selectedDetailId?: string;
};

const VIGENTE_OPTIONS = ["Si", "No"];

function renderSubRow(row: Row<TenantsViewRow>): React.ReactNode {
  return <TenantContractSubRow contratos={row.original.contratos} />;
}

export function TenantsViewTable({
  rows,
  selectedDetailId
}: TenantsViewTableProps): JSX.Element {
  const columns = useMemo<ColumnDef<TenantsViewRow, unknown>[]>(
    () => [
      {
        id: "_expand",
        header: "",
        enableSorting: false,
        enableColumnFilter: false,
        size: 32,
        cell: ({ row }) =>
          row.original.contratos.length > 0 ? (
            <TableDisclosureButton
              expanded={row.getIsExpanded()}
              label={row.getIsExpanded() ? "Contraer contratos" : "Ver contratos"}
              onToggle={() => row.toggleExpanded()}
            />
          ) : null,
      },
      {
        accessorKey: "nombreComercial",
        header: "Arrendatario",
        filterFn: "includesString",
        meta: { filterType: "text" },
        cell: ({ row }) => (
          <Link
            href={`/tenants/${row.original.id}`}
            className="font-medium text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
          >
            {row.original.nombreComercial}
          </Link>
        ),
      },
      statusBadgeColumn<TenantsViewRow>({
        id: "vigente",
        accessorFn: (row) => (row.vigente ? "Si" : "No"),
        header: "Vigente",
        options: VIGENTE_OPTIONS,
        getValue: (row) => (row.vigente ? "Si" : "No"),
        getClassName: (value) =>
          value === "Si"
            ? "rounded-full border-emerald-200 bg-emerald-100 text-emerald-700"
            : "rounded-full border-slate-200 bg-slate-100 text-slate-700",
      }),
      {
        accessorKey: "contratosAsociados",
        header: "Contratos",
        filterFn: "inNumberRange",
        meta: {
          isNumeric: true,
          align: "right",
          filterType: "number",
          summary: { type: "sum" },
        },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.contratosAsociados}</span>
        ),
      },
      {
        accessorKey: "contratosVigentes",
        header: "Activos período",
        filterFn: "inNumberRange",
        meta: {
          isNumeric: true,
          align: "right",
          filterType: "number",
          summary: { type: "sum" },
        },
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-brand-700">
            {row.original.contratosVigentes}
          </span>
        ),
      },
      {
        accessorKey: "contratosVigentesNumeros",
        header: "N° contrato",
        filterFn: "includesString",
        enableSorting: false,
        meta: { filterType: "text" },
        cell: ({ row }) => (
          <span className="block border-l border-slate-200 pl-3 font-mono text-[11px] text-slate-500">
            {row.original.contratosVigentesNumeros || "—"}
          </span>
        ),
      },
    ],
    []
  );

  const { table } = useDataTable(rows, columns, { expandable: true });

  return (
    <DataTable
      table={table}
      density="compact"
      summaryRow={{ enabled: true, label: "Totales" }}
      renderSubRow={renderSubRow}
      emptyMessage="No se encontraron arrendatarios con contratos activos para los filtros aplicados."
      selectedId={selectedDetailId}
    />
  );
}
