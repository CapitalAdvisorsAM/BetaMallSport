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
import type { LocalRef, TenantRef } from "@/types/finance";

type AccountingMapping = {
  id: string;
  externalUnit: string;
  unitId: string;
  unit: { codigo: string; nombre: string };
};

type SalesMapping = {
  id: string;
  salesAccountId: string;
  storeName: string;
  tenantId: string;
  tenant: { nombreComercial: string; rut: string };
};

type AccountingTenantMapping = {
  id: string;
  externalTenant: string;
  tenantId: string;
  tenant: { nombreComercial: string; razonSocial: string; rut: string };
};

type UnmappedAccountingRecord = {
  id: string;
  period: string;
  unitId: string | null;
  tenantId: string | null;
  externalUnit: string | null;
  externalTenant: string | null;
  group1: string;
  group3: string;
  denomination: string;
  valueUf: number;
  valueClp: number | null;
};

type TabKey = "accounting" | "sales" | "accounting-tenants" | "unmapped-accounting";

type FinanceMappingsClientProps = {
  selectedProjectId: string;
  accountingMappings: AccountingMapping[];
  salesMappings: SalesMapping[];
  accountingTenantMappings: AccountingTenantMapping[];
  unmappedAccountingRecords: UnmappedAccountingRecord[];
  units: LocalRef[];
  tenants: TenantRef[];
  defaultTab: TabKey;
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
          {unit.codigo === unit.nombre ? unit.codigo : `${unit.codigo} - ${unit.nombre}`}
        </option>
      ))}
    </select>
  );
}

function TenantSelect({
  value,
  tenants,
  onChange
}: {
  value: string;
  tenants: TenantRef[];
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      <option value="">Seleccionar...</option>
      {tenants.map((tenant) => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.nombreComercial} ({tenant.rut})
        </option>
      ))}
    </select>
  );
}

const numberFormatter = new Intl.NumberFormat("es-CL", {
  maximumFractionDigits: 0
});

const ufFormatter = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatClp(value: number | null): string {
  if (value === null) return "-";
  return `$${numberFormatter.format(value)}`;
}

function formatUfValue(value: number): string {
  return `${ufFormatter.format(value)} UF`;
}

function getMissingLabel(record: UnmappedAccountingRecord): string {
  if (!record.unitId && !record.tenantId) return "Local y arrendatario";
  if (!record.unitId) return "Local";
  return "Arrendatario";
}

export function FinanceMappingsClient({
  selectedProjectId,
  accountingMappings,
  salesMappings,
  accountingTenantMappings,
  unmappedAccountingRecords,
  units,
  tenants,
  defaultTab
}: FinanceMappingsClientProps): JSX.Element {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(defaultTab);
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

  const [externalTenantName, setExternalTenantName] = useState("");
  const [tenantMappingTenantId, setTenantMappingTenantId] = useState("");
  const [savingTenantMapping, setSavingTenantMapping] = useState(false);
  const [tenantMappingError, setTenantMappingError] = useState<string | null>(null);

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
      const response = await fetch("/api/real/mappings/accounting", {
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
    const trimmedSalesAccountId = salesAccountId.trim();
    if (!trimmedSalesAccountId || !storeName.trim() || !salesUnitId) {
      return;
    }

    setSavingSales(true);
    setSalesError(null);

    try {
      const response = await fetch("/api/real/mappings/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          salesAccountId: trimmedSalesAccountId,
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

  async function saveTenantMapping(): Promise<void> {
    const trimmed = externalTenantName.trim();
    if (!trimmed || !tenantMappingTenantId) {
      return;
    }

    setSavingTenantMapping(true);
    setTenantMappingError(null);

    try {
      const response = await fetch("/api/real/mappings/accounting-tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          externalTenant: trimmed,
          tenantId: tenantMappingTenantId
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudo guardar el mapeo de arrendatario.");
      }

      setExternalTenantName("");
      setTenantMappingTenantId("");
      refreshPage();
    } catch (error) {
      setTenantMappingError(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSavingTenantMapping(false);
    }
  }

  const deleteMapping = useCallback(
    async (id: string, type: TabKey): Promise<void> => {
      const endpoint =
        type === "accounting"
          ? `/api/real/mappings/accounting?id=${id}`
          : type === "sales"
            ? `/api/real/mappings/sales?id=${id}`
            : `/api/real/mappings/accounting-tenants?id=${id}`;

      await fetch(endpoint, { method: "DELETE" });
      refreshPage();
    },
    [refreshPage]
  );

  const updateTenantMappingTenant = useCallback(
    async (mapping: AccountingTenantMapping, tenantId: string): Promise<void> => {
      await fetch("/api/real/mappings/accounting-tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          externalTenant: mapping.externalTenant,
          tenantId
        })
      });
      refreshPage();
    },
    [refreshPage, selectedProjectId]
  );

  const updateAccountingUnit = useCallback(
    async (mapping: AccountingMapping, unitId: string): Promise<void> => {
      await fetch("/api/real/mappings/accounting", {
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
        meta: { filterType: "text" },
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
        id: "tenant",
        accessorFn: (row) => `${row.tenant.nombreComercial} ${row.tenant.rut}`,
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="text-sm text-slate-700">
            {row.original.tenant.nombreComercial} ({row.original.tenant.rut})
          </span>
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
    [deleteMapping]
  );

  const accountingTenantColumns = useMemo<ColumnDef<AccountingTenantMapping, unknown>[]>(
    () => [
      {
        accessorKey: "externalTenant",
        header: "Arrendatario en Excel",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700">{row.original.externalTenant}</span>
        )
      },
      {
        id: "tenant",
        accessorFn: (row) => `${row.tenant.nombreComercial} ${row.tenant.razonSocial} ${row.tenant.rut}`,
        header: "Arrendatario en plataforma",
        filterFn: "includesString",
        cell: ({ row }) => (
          <TenantSelect
            value={row.original.tenantId}
            tenants={tenants}
            onChange={(value) => void updateTenantMappingTenant(row.original, value)}
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
            onClick={() => void deleteMapping(row.original.id, "accounting-tenants")}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Eliminar
          </button>
        )
      }
    ],
    [deleteMapping, tenants, updateTenantMappingTenant]
  );

  const unmappedAccountingColumns = useMemo<ColumnDef<UnmappedAccountingRecord, unknown>[]>(
    () => [
      {
        accessorKey: "period",
        header: "Periodo",
        filterFn: "includesString",
        cell: ({ row }) => <span className="font-mono text-xs text-slate-700">{row.original.period}</span>
      },
      {
        id: "missing",
        accessorFn: getMissingLabel,
        header: "Falta",
        meta: {
          filterType: "enum",
          filterOptions: ["Local", "Arrendatario", "Local y arrendatario"]
        },
        cell: ({ row }) => (
          <span className="rounded-sm bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-700">
            {getMissingLabel(row.original)}
          </span>
        )
      },
      {
        accessorKey: "externalUnit",
        header: "Local externo",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700">{row.original.externalUnit || "-"}</span>
        )
      },
      {
        accessorKey: "externalTenant",
        header: "Arrendatario externo",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-xs text-slate-700">{row.original.externalTenant || "-"}</span>
      },
      {
        accessorKey: "group1",
        header: "Grupo 1",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-xs font-medium text-slate-700">{row.original.group1}</span>
      },
      {
        accessorKey: "group3",
        header: "Grupo 3",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-xs text-slate-700">{row.original.group3}</span>
      },
      {
        accessorKey: "denomination",
        header: "Detalle",
        filterFn: "includesString",
        cell: ({ row }) => <span className="text-xs text-slate-600">{row.original.denomination}</span>
      },
      {
        accessorKey: "valueUf",
        header: "UF",
        meta: { align: "right", filterType: "number" },
        cell: ({ row }) => <span className="font-mono text-xs text-slate-700">{formatUfValue(row.original.valueUf)}</span>
      },
      {
        accessorKey: "valueClp",
        header: "CLP",
        meta: { align: "right", filterType: "number" },
        cell: ({ row }) => <span className="font-mono text-xs text-slate-700">{formatClp(row.original.valueClp)}</span>
      }
    ],
    []
  );

  const { table: accountingTable } = useDataTable(accountingMappings, accountingColumns);
  const { table: salesTable } = useDataTable(salesMappings, salesColumns);
  const { table: accountingTenantTable } = useDataTable(accountingTenantMappings, accountingTenantColumns);
  const { table: unmappedAccountingTable } = useDataTable(
    unmappedAccountingRecords,
    unmappedAccountingColumns
  );
  const missingUnitCount = unmappedAccountingRecords.filter((record) => !record.unitId).length;
  const missingTenantCount = unmappedAccountingRecords.filter((record) => !record.tenantId).length;
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

      <section className="flex flex-wrap gap-2">
        <TabButton active={tab === "accounting"} onClick={() => setTab("accounting")}>
          Locales contables ({accountingMappings.length})
        </TabButton>
        <TabButton
          active={tab === "accounting-tenants"}
          onClick={() => setTab("accounting-tenants")}
        >
          Arrendatarios contables ({accountingTenantMappings.length})
        </TabButton>
        <TabButton
          active={tab === "unmapped-accounting"}
          onClick={() => setTab("unmapped-accounting")}
        >
          Registros sin asociar ({unmappedAccountingRecords.length})
        </TabButton>
        <TabButton active={tab === "sales"} onClick={() => setTab("sales")}>
          Ventas ({salesMappings.length})
        </TabButton>
      </section>

      {tab === "accounting" && (
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
      )}

      {tab === "accounting-tenants" && (
        <div className="space-y-4">
          <ModuleSectionCard title="Agregar mapeo de arrendatario contable">
            <div className="flex flex-wrap items-end gap-3 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="external-tenant">
                  Nombre del arrendatario en Excel
                </label>
                <Input
                  id="external-tenant"
                  value={externalTenantName}
                  onChange={(event) => setExternalTenantName(event.target.value)}
                  placeholder="Mountain Hardwear"
                  className="w-[260px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="tenant-mapping-tenant">
                  Arrendatario en plataforma
                </label>
                <TenantSelect
                  value={tenantMappingTenantId}
                  tenants={tenants}
                  onChange={setTenantMappingTenantId}
                />
              </div>
              <Button
                type="button"
                onClick={() => void saveTenantMapping()}
                disabled={
                  savingTenantMapping ||
                  !externalTenantName.trim() ||
                  !tenantMappingTenantId ||
                  isPending
                }
              >
                {savingTenantMapping ? "Guardando..." : "Guardar"}
              </Button>
            </div>
            {tenantMappingError ? (
              <p className="px-4 pb-4 text-xs text-red-600">{tenantMappingError}</p>
            ) : null}
          </ModuleSectionCard>

          <ModuleSectionCard
            title={`Arrendatarios contables (${accountingTenantMappings.length})`}
          >
            <div className="p-4">
              <DataTable
                table={accountingTenantTable}
                emptyMessage="Sin mapeos. Sube data contable o agrega uno manualmente."
              />
            </div>
          </ModuleSectionCard>
        </div>
      )}

      {tab === "unmapped-accounting" && (
        <div className="space-y-4">
          <ModuleSectionCard
            title={`Registros contables sin asociar (${unmappedAccountingRecords.length})`}
            description={`${missingUnitCount} fila(s) sin local y ${missingTenantCount} fila(s) sin arrendatario.`}
          >
            <div className="p-4">
              <DataTable
                table={unmappedAccountingTable}
                emptyMessage="Toda la data contable cargada tiene local y arrendatario asociado."
                virtualize
              />
            </div>
          </ModuleSectionCard>
        </div>
      )}

      {tab === "sales" && (
        <div className="space-y-4">
          <ModuleSectionCard title="Agregar mapeo de ventas manual">
            <div className="flex flex-wrap items-end gap-3 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="sales-account-id">
                  ID CA
                </label>
                <Input
                  id="sales-account-id"
                  value={salesAccountId}
                  onChange={(event) => setSalesAccountId(event.target.value)}
                  placeholder="L102"
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
