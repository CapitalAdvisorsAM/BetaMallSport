"use client";

import { useCallback, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { EntityActionsCell } from "@/components/crud/EntityActionsCell";
import { EntityCrudShell } from "@/components/crud/EntityCrudShell";
import { EntityFormSection } from "@/components/crud/EntityFormSection";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCrudResource } from "@/hooks/useCrudResource";
import { useDataTable } from "@/hooks/useDataTable";
import { extractApiErrorMessage } from "@/lib/http/client-errors";
import { buildProjectIdQueryString } from "@/lib/project-query";

type ZoneRecord = {
  id: string;
  proyectoId: string;
  nombre: string;
};

type ZonesConfigPanelProps = {
  projectId: string;
  canEdit: boolean;
  initialZones: ZoneRecord[];
};

function toZoneRecord(value: Partial<ZoneRecord>): ZoneRecord {
  return {
    id: value.id ?? "",
    proyectoId: value.proyectoId ?? "",
    nombre: value.nombre ?? ""
  };
}

async function createZone(payload: Omit<ZoneRecord, "id">): Promise<ZoneRecord> {
  const response = await fetch("/api/zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = (await response.json()) as Partial<ZoneRecord> & { message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message ?? "No se pudo crear la zona.");
  }
  return toZoneRecord(data);
}

async function updateZone(id: string, payload: Omit<ZoneRecord, "id">): Promise<ZoneRecord> {
  const query = buildProjectIdQueryString(payload.proyectoId);
  const response = await fetch(`/api/zones/${id}?${query}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = (await response.json()) as Partial<ZoneRecord> & { message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message ?? "No se pudo actualizar la zona.");
  }
  return toZoneRecord(data);
}

async function removeZone(id: string, projectId: string): Promise<void> {
  const query = buildProjectIdQueryString(projectId);
  const response = await fetch(`/api/zones/${id}?${query}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "No se pudo eliminar la zona."));
  }
}

export function ZonesConfigPanel({
  projectId,
  canEdit,
  initialZones
}: ZonesConfigPanelProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [nombreError, setNombreError] = useState<string | null>(null);

  const { data: zones, status, error, isLoading, createOne, updateOne, deleteOne, resetStatus } =
    useCrudResource<ZoneRecord, Omit<ZoneRecord, "id">, Omit<ZoneRecord, "id">>({
      initialData: initialZones,
      getId: (zone) => zone.id,
      create: createZone,
      update: updateZone,
      remove: (id) => removeZone(id, projectId),
      sort: (a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    });

  const beginCreate = useCallback((): void => {
    setSelectedId(null);
    setNombre("");
    setNombreError(null);
    resetStatus();
  }, [resetStatus]);

  const beginEdit = useCallback(
    (zone: ZoneRecord): void => {
      setSelectedId(zone.id);
      setNombre(zone.nombre);
      setNombreError(null);
      resetStatus();
    },
    [resetStatus]
  );

  const columns = useMemo<ColumnDef<ZoneRecord, unknown>[]>(
    () => [
      {
        accessorKey: "nombre",
        header: "Nombre zona",
        filterFn: "includesString",
        cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span>
      },
      {
        id: "acciones",
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <EntityActionsCell
            canEdit={canEdit}
            loading={isLoading}
            onEdit={() => beginEdit(row.original)}
            onDelete={() => setPendingDeleteId(row.original.id)}
          />
        )
      }
    ],
    [beginEdit, canEdit, isLoading]
  );

  const { table } = useDataTable(zones, columns);

  async function handleSubmit(): Promise<void> {
    if (!canEdit || isLoading) return;

    const trimmed = nombre.trim();
    if (!trimmed) {
      setNombreError("Nombre es obligatorio.");
      return;
    }

    setNombreError(null);
    resetStatus();

    const payload = { proyectoId: projectId, nombre: trimmed };

    const saved = selectedId
      ? await updateOne(selectedId, payload, "No se pudo actualizar la zona.")
      : await createOne(payload, "No se pudo crear la zona.");

    if (!saved) {
      toast.error("No se pudo guardar la zona.");
      return;
    }

    toast.success(selectedId ? "Zona actualizada correctamente." : "Zona creada correctamente.");
    beginCreate();
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDeleteId || !canEdit || isLoading) return;

    resetStatus();
    const deleted = await deleteOne(pendingDeleteId, "No se pudo eliminar la zona.");
    if (!deleted) {
      toast.error("No se pudo eliminar la zona.");
      return;
    }

    if (selectedId === pendingDeleteId) {
      beginCreate();
    }
    setPendingDeleteId(null);
    toast.success("Zona eliminada correctamente.");
  }

  return (
    <>
      <EntityCrudShell
        title="Zonas del proyecto"
        canEdit={canEdit}
        readOnlyMessage="Tu rol es de solo lectura."
        toolbar={
          <Button
            type="button"
            onClick={beginCreate}
            variant="outline"
            className="h-auto px-3 py-2 text-sm"
          >
            Nueva zona
          </Button>
        }
        message={status === "error" ? error : null}
        form={
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-slate-700">
                  Nombre <span className="text-rose-500">*</span>
                </span>
                <Input
                  value={nombre}
                  onChange={(event) => {
                    setNombre(event.target.value);
                    setNombreError(null);
                  }}
                  placeholder="Ej: Zona A, Patio de Comidas, Norte"
                  className={`w-full rounded-md border px-3 py-2 ${nombreError ? "border-rose-500" : "border-slate-300"}`}
                />
                {nombreError ? <p className="mt-0.5 text-xs text-rose-600">{nombreError}</p> : null}
              </label>
            </div>
            <EntityFormSection
              mode={selectedId ? "edit" : "create"}
              canEdit={canEdit}
              isLoading={isLoading}
              onSubmit={() => { void handleSubmit(); }}
              submitCreateLabel="Crear zona"
              submitEditLabel="Actualizar zona"
            />
          </div>
        }
        table={
          <DataTable
            table={table}
            emptyMessage="No hay zonas definidas. Agrega la primera usando el formulario."
          />
        }
      />

      <ConfirmModal
        open={Boolean(pendingDeleteId)}
        title="Eliminar zona"
        description="Se eliminará esta zona. Los locales asociados quedarán sin zona asignada. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => { void handleDelete(); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}
