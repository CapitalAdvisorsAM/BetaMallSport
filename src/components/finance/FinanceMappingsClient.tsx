"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDataTable } from "@/hooks/useDataTable";
import { buildExportExcelUrl } from "@/lib/export/shared";
import type { LocalRef, ProjectOption } from "@/types/finance";

type AccountingMapping = {
  id: string;
  externalUnit: string;
  unitId: string;
  unit: { codigo: string; nombre: string };
};

type SalesMapping = {
  id: string;
  salesAccountId: number;
  storeName: string;
  unitId: string;
  unit: { codigo: string; nombre: string };
};

type FinanceMappingsClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  accountingMappings: AccountingMapping[];
  salesMappings: SalesMapping[];
  units: LocalRef[];
  defaultTab: "accounting" | "sales";
};

type TabButtonProps = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

function TabButton({ active, onClick, children }: TabButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white"
          : "rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
      }
    >
      {children}
    </button>
  );
}

function UnitSelect({
  value,
  units,
  onChange
}: {
  value: string;
  units: LocalRef[];
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      <option value="">Seleccionar...</option>
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.codigo} - {unit.nombre}
        </option>
      ))}
    </select>
  );
}

export function FinanceMappingsClient({
  projects,
  selectedProjectId,
  accountingMappings,
  salesMappings,
  units,
  defaultTab
}: FinanceMappingsClientProps): JSX.Element {
  const router = useRouter();
  const [tab, setTab] = useState<"accounting" | "sales">(defaultTab);
  const [isPending, startTransition] = useTransition();

  const [externalUnit, setExternalUnit] = useState("");
  const [accountingUnitId, setAccountingUnitId] = useState("");
  const [savingAccounting, setSavingAccounting] = useState(false);
  const [accountingError, setAccountingError] = useState<string | null>(null);

  const [salesAccountId, setSalesAccountId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [salesUnitId, setSalesUnitId] = useState("");
  const [savingSales, setSavingSales] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  const refreshPage = useCallback((): void => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  async function saveAccounting(): Promise<void> {
    if (!externalUnit.trim() || !accountingUnitId) {
      return;
    }

    setSavingAccounting(true);
    setAccountingError(null);

    try {
      const response = await fetch("/api/finance/mappings/accounting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          externalUnit: externalUnit.trim().toUpperCase(),
          unitId: accountingUnitId
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudo guardar el mapeo contable.");
      }

      setExternalUnit("");
      setAccountingUnitId("");
      refreshPage();
    } catch (error) {
      setAccountingError(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSavingAccounting(false);
    }
  }

  async function saveSales(): Promise<void> {
    const parsedSalesAccountId = Number.parseInt(salesAccountId, 10);
    if (!Number.isFinite(parsedSalesAccountId) || !storeName.trim() || !salesUnitId) {
      return;
    }

    setSavingSales(true);
    setSalesError(null);

    try {
      const response = await fetch("/api/finance/mappings/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          salesAccountId: parsedSalesAccountId,
          storeName: storeName.trim(),
          unitId: salesUnitId
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudo guardar el mapeo de ventas.");
      }

      setSalesAccountId("");
      setStoreName("");
      setSalesUnitId("");
      refreshPage();
    } catch (error) {
      setSalesError(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSavingSales(false);
    }
  }

  const deleteMapping = useCallback(
    async (id: string, type: "accounting" | "sales"): Promise<void> => {
      const endpoint =
        type === "accounting"
          ? `/api/finance/mappings/accounting?id=${id}`
          : `/api/finance/mappings/sales?id=${id}`;

      await fetch(endpoint, { method: "DELETE" });
      refreshPage();
    },
    [refreshPage]
  );

  const updateAccountingUnit = useCallback(
    async (mapping: AccountingMapping, unitId: string): Promise<void> => {
      await fetch("/api/finance/mappings/accounting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          externalUnit: mapping.externalUnit,
          unitId
        })
      });
      refreshPage();
    },
    [refreshPage, selectedProjectId]
  );

  const updateSalesUnit = useCallback(
    async (mapping: SalesMapping, unitId: string): Promise<void> => {
      await fetch("/api/finance/mappings/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          salesAccountId: mapping.salesAccountId,
          storeName: mapping.storeName,
          unitId
        })
      });
      refreshPage();
    },
    [refreshPage, selectedProjectId]
  );

  const accountingColumns = useMemo<ColumnDef<AccountingMapping, unknown>[]>(
    () => [
      {
        accessorKey: "externalUnit",
        header: "Codigo Externo",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700">{row.original.externalUnit}</span>
        )
      },
      {
        id: "unit",
        accessorFn: (row) => `${row.unit.codigo} ${row.unit.nombre}`,
        header: "Local Rent Roll",
        filterFn: "includesString",
        cell: ({ row }) => (
          <UnitSelect
            value={row.original.unitId}
            units={units}
            onChange={(value) => void updateAccountingUnit(row.original, value)}
          />
        )
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => void deleteMapping(row.original.id, "accounting")}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Eliminar
          </button>
        )
      }
    ],
    [deleteMapping, units, updateAccountingUnit]
  );

  const salesColumns = useMemo<ColumnDef<SalesMapping, unknown>[]>(
    () => [
      {
        accessorKey: "salesAccountId",
        header: "ID CA",
        meta: { align: "right", filterType: "number" },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700">{row.original.salesAccountId}</span>
        )
      },
      {
        accessorKey: "storeName",
        header: "Tienda",
        filterFn: "includesString"
      },
      {
        id: "unit",
        accessorFn: (row) => `${row.unit.codigo} ${row.unit.nombre}`,
        header: "Local Rent Roll",
        filterFn: "includesString",
        cell: ({ row }) => (
          <UnitSelect
            value={row.original.unitId}
            units={units}
            onChange={(value) => void updateSalesUnit(row.original, value)}
          />
        )
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => void deleteMapping(row.original.id, "sales")}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Eliminar
          </button>
        )
      }
    ],
    [deleteMapping, units, updateSalesUnit]
  );

  const { table: accountingTable } = useDataTable(accountingMappings, accountingColumns);
  const { table: salesTable } = useDataTable(salesMappings, salesColumns);
  const filteredExportHref = buildExportExcelUrl({
    dataset: "finance_mappings",
    scope: "filtered",
    projectId: selectedProjectId,
    tab
  });
  const allExportHref = buildExportExcelUrl({
    dataset: "finance_mappings",
    scope: "all",
    projectId: selectedProjectId
  });

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Mapeos"
        description="Vincula los identificadores externos con los locales del rent roll."
        projects={projects}
        selectedProjectId={selectedProjectId}
        showProjectSelector={false}
        preserve={{ tab }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm">
              <a href={filteredExportHref}>Descargar filtrado</a>
            </Button>
            <Button asChild type="button" size="sm">
              <a href={allExportHref}>Descargar todo</a>
            </Button>
          </div>
        }
      />

      <section className="flex gap-2">
        <TabButton active={tab === "accounting"} onClick={() => setTab("accounting")}>
          Contabilidad ({accountingMappings.length})
        </TabButton>
        <TabButton active={tab === "sales"} onClick={() => setTab("sales")}>
          Ventas ({salesMappings.length})
        </TabButton>
      </section>

      {tab === "accounting" ? (
        <div className="space-y-4">
          <ModuleSectionCard title="Agregar mapeo contable manual">
            <div className="flex flex-wrap items-end gap-3 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="external-unit">
                  Codigo local contabilidad
                </label>
                <Input
                  id="external-unit"
                  value={externalUnit}
                  onChange={(event) => setExternalUnit(event.target.value)}
                  placeholder="102"
                  className="w-[220px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="accounting-unit">
                  Local Rent Roll
                </label>
                <UnitSelect value={accountingUnitId} units={units} onChange={setAccountingUnitId} />
              </div>
              <Button
                type="button"
                onClick={() => void saveAccounting()}
                disabled={savingAccounting || !externalUnit.trim() || !accountingUnitId || isPending}
              >
                {savingAccounting ? "Guardando..." : "Guardar"}
              </Button>
            </div>
            {accountingError ? <p className="px-4 pb-4 text-xs text-red-600">{accountingError}</p> : null}
          </ModuleSectionCard>

          <ModuleSectionCard title={`Mapeos contables (${accountingMappings.length})`}>
            <div className="p-4">
              <DataTable
                table={accountingTable}
                emptyMessage="Sin mapeos contables. Sube un archivo o agrega uno manualmente."
              />
            </div>
          </ModuleSectionCard>
        </div>
      ) : (
        <div className="space-y-4">
          <ModuleSectionCard title="Agregar mapeo de ventas manual">
            <div className="flex flex-wrap items-end gap-3 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="sales-account-id">
                  ID CA
                </label>
                <Input
                  id="sales-account-id"
                  type="number"
                  value={salesAccountId}
                  onChange={(event) => setSalesAccountId(event.target.value)}
                  placeholder="217"
                  className="w-[180px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="store-name">
                  Nombre tienda
                </label>
                <Input
                  id="store-name"
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="Mountain Hardwear"
                  className="w-[260px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="sales-unit">
                  Local Rent Roll
                </label>
                <UnitSelect value={salesUnitId} units={units} onChange={setSalesUnitId} />
              </div>
              <Button
                type="button"
                onClick={() => void saveSales()}
                disabled={savingSales || !salesAccountId || !storeName.trim() || !salesUnitId || isPending}
              >
                {savingSales ? "Guardando..." : "Guardar"}
              </Button>
            </div>
            {salesError ? <p className="px-4 pb-4 text-xs text-red-600">{salesError}</p> : null}
          </ModuleSectionCard>

          <ModuleSectionCard title={`Mapeos de ventas (${salesMappings.length})`}>
            <div className="p-4">
              <DataTable
                table={salesTable}
                emptyMessage="Sin mapeos de ventas. Sube un archivo o agrega uno manualmente."
              />
            </div>
          </ModuleSectionCard>
        </div>
      )}
    </main>
  );
}
