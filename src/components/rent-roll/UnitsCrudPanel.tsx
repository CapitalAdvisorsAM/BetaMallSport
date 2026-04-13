"use client";

import { useCallback, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { EntityActionsCell } from "@/components/crud/EntityActionsCell";
import { EntityCrudShell } from "@/components/crud/EntityCrudShell";
import { EntityFormSection } from "@/components/crud/EntityFormSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enumFilterColumn, numberFilterColumn } from "@/components/ui/data-table-columns";
import { useCrudResource } from "@/hooks/useCrudResource";
import { useDataTable } from "@/hooks/useDataTable";
import { extractApiErrorMessage } from "@/lib/http/client-errors";
import { formatCalculatedLocalSize, getCalculatedLocalSize } from "@/lib/units/size";
import { buildProjectIdQueryString } from "@/lib/project-query";
import { cn, formatDecimal } from "@/lib/utils";

type LocalTipo =
  | "LOCAL_COMERCIAL"
  | "SIMULADOR"
  | "MODULO"
  | "ESPACIO"
  | "BODEGA"
  | "OTRO";
type MasterStatus = "ACTIVO" | "INACTIVO";

type ZoneOption = {
  id: string;
  nombre: string;
};

type LocalRecord = {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  glam2: string;
  piso: string;
  tipo: LocalTipo;
  zonaId: string | null;
  esGLA: boolean;
  estado: MasterStatus;
};

type LocalForm = Omit<LocalRecord, "id">;

type UnitsCrudPanelProps = {
  projectId: string;
  canEdit: boolean;
  initialLocales: LocalRecord[];
  zones: ReadonlyArray<ZoneOption>;
};

function createEmptyForm(projectId: string): LocalForm {
  return {
    proyectoId: projectId,
    codigo: "",
    nombre: "",
    glam2: "",
    piso: "",
    tipo: "LOCAL_COMERCIAL",
    zonaId: null,
    esGLA: true,
    estado: "ACTIVO"
  };
}

function toLocalRecord(value: Partial<LocalRecord>): LocalRecord {
  return {
    id: value.id ?? "",
    proyectoId: value.proyectoId ?? "",
    codigo: value.codigo ?? "",
    nombre: value.nombre ?? "",
    glam2: typeof value.glam2 === "string" ? value.glam2 : String(value.glam2 ?? ""),
    piso: value.piso ?? "",
    tipo: value.tipo ?? "LOCAL_COMERCIAL",
    zonaId: value.zonaId ?? null,
    esGLA: Boolean(value.esGLA),
    estado: value.estado ?? "ACTIVO"
  };
}

function parseDecimal(value: string): number | undefined {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function createUnit(form: LocalForm): Promise<LocalRecord> {
  const response = await fetch("/api/units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form)
  });
  const data = (await response.json()) as Partial<LocalRecord> & { message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message ?? "No se pudo guardar el local.");
  }
  return toLocalRecord(data);
}

async function updateUnit(id: string, form: LocalForm): Promise<LocalRecord> {
  const query = buildProjectIdQueryString(form.proyectoId);
  const response = await fetch(`/api/units/${id}?${query}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form)
  });
  const data = (await response.json()) as Partial<LocalRecord> & { message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message ?? "No se pudo guardar el local.");
  }
  return toLocalRecord(data);
}

async function removeUnit(id: string, projectId: string): Promise<void> {
  const query = buildProjectIdQueryString(projectId);
  const response = await fetch(`/api/units/${id}?${query}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "No se pudo eliminar el local."));
  }
}

export function UnitsCrudPanel({
  projectId,
  canEdit,
  initialLocales,
  zones
}: UnitsCrudPanelProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<LocalForm>(createEmptyForm(projectId));
  const glam2Missing = !String(form.glam2).trim();

  const { data: locales, status, error, isLoading, createOne, updateOne, deleteOne, resetStatus } =
    useCrudResource<LocalRecord, LocalForm, LocalForm>({
      initialData: initialLocales,
      getId: (local) => local.id,
      create: createUnit,
      update: updateUnit,
      remove: (localId) => removeUnit(localId, projectId),
      sort: (a, b) => a.codigo.localeCompare(b.codigo, "es", { sensitivity: "base" })
    });

  const beginCreate = useCallback((): void => {
    setSelectedId(null);
    setFieldErrors({});
    setForm(createEmptyForm(projectId));
    resetStatus();
  }, [projectId, resetStatus]);

  const beginEdit = useCallback((local: LocalRecord): void => {
    setSelectedId(local.id);
    setFieldErrors({});
    setForm({
      proyectoId: local.proyectoId,
      codigo: local.codigo,
      nombre: local.nombre,
      glam2: local.glam2,
      piso: local.piso,
      tipo: local.tipo,
      zonaId: local.zonaId,
      esGLA: local.esGLA,
      estado: local.estado
    });
    resetStatus();
  }, [resetStatus]);

  const columns = useMemo<ColumnDef<LocalRecord, unknown>[]>(
    () => [
      {
        accessorKey: "codigo",
        header: "Codigo",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap font-medium">{row.original.codigo}</span>
      },
      {
        accessorKey: "nombre",
        header: "Nombre",
        filterFn: "includesString",
        cell: ({ row }) => <span>{row.original.nombre || "-"}</span>
      },
      enumFilterColumn<LocalRecord>({
        accessorKey: "tipo",
        header: "Tipo",
        options: ["LOCAL_COMERCIAL", "SIMULADOR", "MODULO", "ESPACIO", "BODEGA", "OTRO"],
        cell: (row) => <span className="whitespace-nowrap">{row.tipo}</span>
      }),
      {
        accessorKey: "piso",
        header: "Piso",
        enableColumnFilter: false,
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.piso}</span>
      },
      {
        accessorKey: "zonaId",
        header: "Zona",
        enableColumnFilter: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {zones.find((z) => z.id === row.original.zonaId)?.nombre ?? "-"}
          </span>
        )
      },
      numberFilterColumn<LocalRecord>({
        id: "glam2",
        accessorFn: (row) => parseDecimal(row.glam2) ?? 0,
        header: "GLA m2",
        cell: (row) => <span className="whitespace-nowrap">{formatDecimal(row.glam2)}</span>
      }),
      {
        id: "tamanoCalculado",
        accessorFn: (row) => formatCalculatedLocalSize(getCalculatedLocalSize(row.tipo, row.glam2)),
        header: "Tamano calculado",
        filterFn: "includesString",
        enableColumnFilter: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatCalculatedLocalSize(getCalculatedLocalSize(row.original.tipo, row.original.glam2))}
          </span>
        )
      },
      enumFilterColumn<LocalRecord>({
        id: "esGLA",
        accessorFn: (row) => (row.esGLA ? "Si" : "No"),
        header: "Es GLA",
        options: ["Si", "No"],
        align: "center",
        cell: (row) => <span className="whitespace-nowrap">{row.esGLA ? "Si" : "No"}</span>
      }),
      enumFilterColumn<LocalRecord>({
        accessorKey: "estado",
        header: "Estado",
        options: ["ACTIVO", "INACTIVO"],
        cell: (row) => <span className="whitespace-nowrap">{row.estado}</span>
      }),
      {
        id: "acciones",
        accessorFn: (row) => row.id,
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

  const { table } = useDataTable(locales, columns);

  function clearFieldError(field: string): void {
    setFieldErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!form.codigo.trim()) {
      errors.codigo = "Codigo es obligatorio.";
    }
    if (!form.piso.trim()) {
      errors.piso = "Piso es obligatorio.";
    }

    return errors;
  }

  async function handleSubmit(): Promise<void> {
    if (!canEdit || isLoading) {
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.warning("Corrige los campos marcados.");
      return;
    }

    setFieldErrors({});
    resetStatus();

    const saved = selectedId
      ? await updateOne(selectedId, form, "No se pudo guardar el local.")
      : await createOne(form, "No se pudo guardar el local.");

    if (!saved) {
      toast.error("No se pudo guardar el local.");
      return;
    }

    toast.success(selectedId ? "Local actualizado correctamente." : "Local creado correctamente.");
    beginCreate();
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDeleteId || !canEdit || isLoading) {
      return;
    }

    resetStatus();
    const deleted = await deleteOne(pendingDeleteId, "No se pudo eliminar el local.");
    if (!deleted) {
      toast.error("No se pudo eliminar el local.");
      return;
    }

    if (selectedId === pendingDeleteId) {
      beginCreate();
    }

    setPendingDeleteId(null);
    toast.success("Local eliminado correctamente.");
  }

  return (
    <>
      <EntityCrudShell
        title="CRUD de Locales"
        canEdit={canEdit}
        readOnlyMessage="Tu rol es de solo lectura para locales."
        toolbar={
          <Button
            type="button"
            onClick={beginCreate}
            variant="outline"
            className="h-auto px-3 py-2 text-sm"
          >
            Nuevo
          </Button>
        }
        message={status === "error" ? error : null}
        form={
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  Codigo <span className="text-rose-500">*</span>
                </span>
                <Input
                  value={form.codigo}
                  onChange={(event) => {
                    setForm({ ...form, codigo: event.target.value });
                    clearFieldError("codigo");
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2",
                    fieldErrors.codigo ? "border-rose-500" : "border-slate-300"
                  )}
                />
                {fieldErrors.codigo ? <p className="mt-0.5 text-xs text-rose-600">{fieldErrors.codigo}</p> : null}
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-slate-700">
                  Nombre <span className="text-xs text-slate-400">(opcional)</span>
                </span>
                <Input
                  value={form.nombre}
                  onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  GLA m2 <span className="text-xs text-slate-400">(opcional)</span>
                </span>
                <Input
                  value={form.glam2}
                  onChange={(event) => {
                    setForm({ ...form, glam2: event.target.value });
                    clearFieldError("glam2");
                  }}
                  placeholder="Ej: 88.5 o 88,5"
                  className={cn(
                    "w-full rounded-md border px-3 py-2",
                    fieldErrors.glam2 ? "border-rose-500" : "border-slate-300"
                  )}
                />
                {fieldErrors.glam2 ? <p className="mt-0.5 text-xs text-rose-600">{fieldErrors.glam2}</p> : null}
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  Piso <span className="text-rose-500">*</span>
                </span>
                <Input
                  value={form.piso}
                  onChange={(event) => {
                    setForm({ ...form, piso: event.target.value });
                    clearFieldError("piso");
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2",
                    fieldErrors.piso ? "border-rose-500" : "border-slate-300"
                  )}
                />
                {fieldErrors.piso ? <p className="mt-0.5 text-xs text-rose-600">{fieldErrors.piso}</p> : null}
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  Tipo <span className="text-rose-500">*</span>
                </span>
                <Select
                  value={form.tipo}
                  onValueChange={(value) => setForm({ ...form, tipo: value as LocalTipo })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL_COMERCIAL">LOCAL COMERCIAL</SelectItem>
                    <SelectItem value="SIMULADOR">SIMULADOR</SelectItem>
                    <SelectItem value="MODULO">MODULO</SelectItem>
                    <SelectItem value="ESPACIO">ESPACIO</SelectItem>
                    <SelectItem value="BODEGA">BODEGA</SelectItem>
                    <SelectItem value="OTRO">OTRO</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <div className="text-sm">
                <span className="mb-1 block text-slate-700">
                  Zona <span className="text-xs text-slate-400">(opcional)</span>
                </span>
                <Select
                  value={form.zonaId ?? "none"}
                  onValueChange={(value) => setForm({ ...form, zonaId: value === "none" ? null : value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin zona</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {zones.length === 0 && canEdit ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Sin zonas definidas. Configúralas en la pestaña Config.
                  </p>
                ) : null}
              </div>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  Estado <span className="text-rose-500">*</span>
                </span>
                <Select
                  value={form.estado}
                  onValueChange={(value) => setForm({ ...form, estado: value as MasterStatus })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                    <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
                <Checkbox
                  checked={form.esGLA}
                  onCheckedChange={(value) => setForm({ ...form, esGLA: value === true })}
                />
                Es GLA
              </label>
            </div>

            {glam2Missing ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Alerta: GLA m2 esta vacio. Se guardara como 0 y puede impactar metricas de ocupacion/GLA.
              </div>
            ) : null}

            <EntityFormSection
              mode={selectedId ? "edit" : "create"}
              canEdit={canEdit}
              isLoading={isLoading}
              onSubmit={() => {
                void handleSubmit();
              }}
              submitCreateLabel="Crear local"
              submitEditLabel="Actualizar local"
            />
          </div>
        }
        table={
          <>
            <DataTable
              table={table}
              emptyMessage="Aun no hay locales registrados. Completa el formulario de arriba para agregar el primero."
            />
            {locales.length === 0 ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  onClick={beginCreate}
                  variant="default"
                  className="h-auto rounded-full px-3 py-1.5 text-xs"
                >
                  Crear primer local
                </Button>
              </div>
            ) : null}
          </>
        }
      />

      <ConfirmModal
        open={Boolean(pendingDeleteId)}
        title="Eliminar local"
        description="Se eliminara este local. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          void handleDelete();
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}
