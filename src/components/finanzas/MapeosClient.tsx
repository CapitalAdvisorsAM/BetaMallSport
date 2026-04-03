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
import type { LocalRef, ProjectOption } from "@/types/finanzas";

type MapeoContable = {
  id: string;
  localExterno: string;
  localId: string;
  local: { codigo: string; nombre: string };
};

type MapeoVentas = {
  id: string;
  idCa: number;
  tiendaNombre: string;
  localId: string;
  local: { codigo: string; nombre: string };
};

type MapeosClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  mapeosContable: MapeoContable[];
  mapeosVentas: MapeoVentas[];
  locales: LocalRef[];
  defaultTab: "contable" | "ventas";
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

function LocalSelect({
  value,
  locales,
  onChange
}: {
  value: string;
  locales: LocalRef[];
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      <option value="">Seleccionar...</option>
      {locales.map((local) => (
        <option key={local.id} value={local.id}>
          {local.codigo} - {local.nombre}
        </option>
      ))}
    </select>
  );
}

export function MapeosClient({
  projects,
  selectedProjectId,
  mapeosContable,
  mapeosVentas,
  locales,
  defaultTab
}: MapeosClientProps): JSX.Element {
  const router = useRouter();
  const [tab, setTab] = useState<"contable" | "ventas">(defaultTab);
  const [isPending, startTransition] = useTransition();

  const [externo, setExterno] = useState("");
  const [localIdContable, setLocalIdContable] = useState("");
  const [savingContable, setSavingContable] = useState(false);
  const [errorContable, setErrorContable] = useState<string | null>(null);

  const [idCa, setIdCa] = useState("");
  const [tiendaNombre, setTiendaNombre] = useState("");
  const [localIdVentas, setLocalIdVentas] = useState("");
  const [savingVentas, setSavingVentas] = useState(false);
  const [errorVentas, setErrorVentas] = useState<string | null>(null);

  const refreshPage = useCallback((): void => {
    startTransition(() => {
      router.refresh();
    });
  }, [router, startTransition]);

  async function saveContable(): Promise<void> {
    if (!externo.trim() || !localIdContable) {
      return;
    }

    setSavingContable(true);
    setErrorContable(null);

    try {
      const response = await fetch("/api/finanzas/mapeos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyectoId: selectedProjectId,
          localExterno: externo.trim().toUpperCase(),
          localId: localIdContable
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudo guardar el mapeo contable.");
      }

      setExterno("");
      setLocalIdContable("");
      refreshPage();
    } catch (saveError) {
      setErrorContable(saveError instanceof Error ? saveError.message : "Error inesperado.");
    } finally {
      setSavingContable(false);
    }
  }

  async function saveVentas(): Promise<void> {
    const parsedIdCa = Number.parseInt(idCa, 10);
    if (!Number.isFinite(parsedIdCa) || !tiendaNombre.trim() || !localIdVentas) {
      return;
    }

    setSavingVentas(true);
    setErrorVentas(null);

    try {
      const response = await fetch("/api/finanzas/mapeos-ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyectoId: selectedProjectId,
          idCa: parsedIdCa,
          tiendaNombre: tiendaNombre.trim(),
          localId: localIdVentas
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? "No se pudo guardar el mapeo de ventas.");
      }

      setIdCa("");
      setTiendaNombre("");
      setLocalIdVentas("");
      refreshPage();
    } catch (saveError) {
      setErrorVentas(saveError instanceof Error ? saveError.message : "Error inesperado.");
    } finally {
      setSavingVentas(false);
    }
  }

  const deleteMapeo = useCallback(async (id: string, type: "contable" | "ventas"): Promise<void> => {
    const endpoint =
      type === "contable" ? `/api/finanzas/mapeos?id=${id}` : `/api/finanzas/mapeos-ventas?id=${id}`;

    await fetch(endpoint, { method: "DELETE" });
    refreshPage();
  }, [refreshPage]);

  const updateLocalContable = useCallback(async (mapeo: MapeoContable, newLocalId: string): Promise<void> => {
    await fetch("/api/finanzas/mapeos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proyectoId: selectedProjectId,
        localExterno: mapeo.localExterno,
        localId: newLocalId
      })
    });
    refreshPage();
  }, [refreshPage, selectedProjectId]);

  const updateLocalVentas = useCallback(async (mapeo: MapeoVentas, newLocalId: string): Promise<void> => {
    await fetch("/api/finanzas/mapeos-ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proyectoId: selectedProjectId,
        idCa: mapeo.idCa,
        tiendaNombre: mapeo.tiendaNombre,
        localId: newLocalId
      })
    });
    refreshPage();
  }, [refreshPage, selectedProjectId]);

  const contableColumns = useMemo<ColumnDef<MapeoContable, unknown>[]>(
    () => [
      {
        accessorKey: "localExterno",
        header: "Codigo Externo",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700">{row.original.localExterno}</span>
        )
      },
      {
        id: "local",
        accessorFn: (row) => `${row.local.codigo} ${row.local.nombre}`,
        header: "Local Rent Roll",
        filterFn: "includesString",
        cell: ({ row }) => (
          <LocalSelect
            value={row.original.localId}
            locales={locales}
            onChange={(value) => void updateLocalContable(row.original, value)}
          />
        )
      },
      {
        id: "acciones",
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => void deleteMapeo(row.original.id, "contable")}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Eliminar
          </button>
        )
      }
    ],
    [deleteMapeo, locales, updateLocalContable]
  );

  const ventasColumns = useMemo<ColumnDef<MapeoVentas, unknown>[]>(
    () => [
      {
        accessorKey: "idCa",
        header: "ID CA",
        meta: { align: "right", filterType: "number" },
        cell: ({ row }) => <span className="font-mono text-xs text-slate-700">{row.original.idCa}</span>
      },
      {
        accessorKey: "tiendaNombre",
        header: "Tienda",
        filterFn: "includesString"
      },
      {
        id: "local",
        accessorFn: (row) => `${row.local.codigo} ${row.local.nombre}`,
        header: "Local Rent Roll",
        filterFn: "includesString",
        cell: ({ row }) => (
          <LocalSelect
            value={row.original.localId}
            locales={locales}
            onChange={(value) => void updateLocalVentas(row.original, value)}
          />
        )
      },
      {
        id: "acciones",
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => void deleteMapeo(row.original.id, "ventas")}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Eliminar
          </button>
        )
      }
    ],
    [deleteMapeo, locales, updateLocalVentas]
  );

  const { table: contableTable } = useDataTable(mapeosContable, contableColumns);
  const { table: ventasTable } = useDataTable(mapeosVentas, ventasColumns);

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Mapeos"
        description="Vincula los identificadores externos con los locales del rent roll."
        projects={projects}
        selectedProjectId={selectedProjectId}
      />

      <section className="flex gap-2">
        <TabButton active={tab === "contable"} onClick={() => setTab("contable")}>
          Contabilidad ({mapeosContable.length})
        </TabButton>
        <TabButton active={tab === "ventas"} onClick={() => setTab("ventas")}>
          Ventas ({mapeosVentas.length})
        </TabButton>
      </section>

      {tab === "contable" ? (
        <div className="space-y-4">
          <ModuleSectionCard title="Agregar mapeo contable manual">
            <div className="flex flex-wrap items-end gap-3 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="local-externo">
                  Codigo local contabilidad
                </label>
                <Input
                  id="local-externo"
                  value={externo}
                  onChange={(event) => setExterno(event.target.value)}
                  placeholder="102"
                  className="w-[220px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="local-contable">
                  Local Rent Roll
                </label>
                <LocalSelect
                  value={localIdContable}
                  locales={locales}
                  onChange={setLocalIdContable}
                />
              </div>
              <Button
                type="button"
                onClick={() => void saveContable()}
                disabled={savingContable || !externo.trim() || !localIdContable || isPending}
              >
                {savingContable ? "Guardando..." : "Guardar"}
              </Button>
            </div>
            {errorContable ? <p className="px-4 pb-4 text-xs text-red-600">{errorContable}</p> : null}
          </ModuleSectionCard>

          <ModuleSectionCard title={`Mapeos contables (${mapeosContable.length})`}>
            <div className="p-4">
              <DataTable
                table={contableTable}
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
                <label className="text-xs font-medium text-slate-500" htmlFor="id-ca">
                  ID CA
                </label>
                <Input
                  id="id-ca"
                  type="number"
                  value={idCa}
                  onChange={(event) => setIdCa(event.target.value)}
                  placeholder="217"
                  className="w-[180px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="tienda-nombre">
                  Nombre tienda
                </label>
                <Input
                  id="tienda-nombre"
                  value={tiendaNombre}
                  onChange={(event) => setTiendaNombre(event.target.value)}
                  placeholder="Mountain Hardwear"
                  className="w-[260px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500" htmlFor="local-ventas">
                  Local Rent Roll
                </label>
                <LocalSelect value={localIdVentas} locales={locales} onChange={setLocalIdVentas} />
              </div>
              <Button
                type="button"
                onClick={() => void saveVentas()}
                disabled={
                  savingVentas || !idCa || !tiendaNombre.trim() || !localIdVentas || isPending
                }
              >
                {savingVentas ? "Guardando..." : "Guardar"}
              </Button>
            </div>
            {errorVentas ? <p className="px-4 pb-4 text-xs text-red-600">{errorVentas}</p> : null}
          </ModuleSectionCard>

          <ModuleSectionCard title={`Mapeos de ventas (${mapeosVentas.length})`}>
            <div className="p-4">
              <DataTable
                table={ventasTable}
                emptyMessage="Sin mapeos de ventas. Sube un archivo o agrega uno manualmente."
              />
            </div>
          </ModuleSectionCard>
        </div>
      )}
    </main>
  );
}
