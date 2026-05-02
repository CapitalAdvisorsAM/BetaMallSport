"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import { useDataTable } from "@/hooks/useDataTable";

type AccountType = "INGRESO" | "COSTO" | "INVERSION" | "OTRO";

type ChartOfAccount = {
  id: string;
  group0: string;
  group1: string;
  group2: string;
  group3: string;
  type: AccountType | null;
  alias: string | null;
  displayOrder: number | null;
  notes: string | null;
};

type ChartOfAccountsClientProps = {
  accounts: ChartOfAccount[];
  canEdit: boolean;
};

const TYPE_OPTIONS: AccountType[] = ["INGRESO", "COSTO", "INVERSION", "OTRO"];

export function ChartOfAccountsClient({
  accounts,
  canEdit
}: ChartOfAccountsClientProps): JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  const refreshPage = useCallback((): void => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  const patch = useCallback(
    async (
      id: string,
      payload: Partial<Pick<ChartOfAccount, "type" | "alias" | "displayOrder" | "notes">>
    ): Promise<void> => {
      setSavingId(id);
      try {
        const response = await fetch(`/api/settings/chart-of-accounts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new Error(body.message ?? "No se pudo guardar.");
        }
        refreshPage();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado.");
      } finally {
        setSavingId(null);
      }
    },
    [refreshPage]
  );

  const columns = useMemo<ColumnDef<ChartOfAccount, unknown>[]>(
    () => [
      {
        accessorKey: "group1",
        header: "GRUPO 1",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-sm font-medium text-slate-700">{row.original.group1}</span>
      },
      {
        accessorKey: "group3",
        header: "GRUPO 3",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-sm text-slate-700">{row.original.group3}</span>
      },
      {
        accessorKey: "group0",
        header: "GRUPO 0",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="text-xs text-slate-500">{row.original.group0 || "—"}</span>
        )
      },
      {
        accessorKey: "group2",
        header: "GRUPO 2",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="text-xs text-slate-500">{row.original.group2 || "—"}</span>
        )
      },
      {
        id: "type",
        accessorFn: (row) => row.type ?? "",
        header: "Tipo",
        meta: {
          filterType: "enum",
          filterOptions: ["", ...TYPE_OPTIONS]
        },
        cell: ({ row }) => (
          <select
            disabled={!canEdit || savingId === row.original.id}
            value={row.original.type ?? ""}
            onChange={(event) =>
              void patch(row.original.id, {
                type: (event.target.value as AccountType) || null
              })
            }
            className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">—</option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      },
      {
        accessorKey: "alias",
        header: "Alias",
        filterFn: "includesString",
        cell: ({ row }) => (
          <Input
            disabled={!canEdit || savingId === row.original.id}
            defaultValue={row.original.alias ?? ""}
            onBlur={(event) => {
              const next = event.target.value.trim();
              const prev = row.original.alias ?? "";
              if (next === prev) return;
              void patch(row.original.id, { alias: next || null });
            }}
            placeholder="—"
            className="h-8 w-[180px] text-xs"
          />
        )
      },
      {
        id: "displayOrder",
        accessorFn: (row) => row.displayOrder ?? 0,
        header: "Orden",
        meta: { align: "right", filterType: "number" },
        cell: ({ row }) => (
          <Input
            disabled={!canEdit || savingId === row.original.id}
            type="number"
            defaultValue={row.original.displayOrder ?? ""}
            onBlur={(event) => {
              const raw = event.target.value;
              const next = raw === "" ? null : Number.parseInt(raw, 10);
              const prev = row.original.displayOrder;
              if (next === prev || (next !== null && Number.isNaN(next))) return;
              void patch(row.original.id, { displayOrder: next });
            }}
            placeholder="—"
            className="h-8 w-[80px] text-right text-xs"
          />
        )
      },
      {
        accessorKey: "notes",
        header: "Notas",
        filterFn: "includesString",
        cell: ({ row }) => (
          <Input
            disabled={!canEdit || savingId === row.original.id}
            defaultValue={row.original.notes ?? ""}
            onBlur={(event) => {
              const next = event.target.value.trim();
              const prev = row.original.notes ?? "";
              if (next === prev) return;
              void patch(row.original.id, { notes: next || null });
            }}
            placeholder="—"
            className="h-8 w-[220px] text-xs"
          />
        )
      }
    ],
    [canEdit, patch, savingId]
  );

  const { table } = useDataTable(accounts, columns);

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Plan de cuentas"
        description="Cuentas contables detectadas en los uploads. Edita tipo, alias, orden y notas para personalizar reportes."
      />

      <ModuleSectionCard title={`Cuentas (${accounts.length})`}>
        <div className="p-4">
          <DataTable
            table={table}
            emptyMessage="Aún no hay cuentas. Sube un archivo de Data Contable para que aparezcan aquí."
          />
        </div>
      </ModuleSectionCard>
    </main>
  );
}
