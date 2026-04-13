"use client";

import { useCallback, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { EntityActionsCell } from "@/components/crud/EntityActionsCell";
import { EntityCrudShell } from "@/components/crud/EntityCrudShell";
import { EntityFormSection } from "@/components/crud/EntityFormSection";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enumFilterColumn } from "@/components/ui/data-table-columns";
import { useCrudResource } from "@/hooks/useCrudResource";
import { useDataTable } from "@/hooks/useDataTable";
import { extractApiErrorMessage } from "@/lib/http/client-errors";
import { buildProjectIdQueryString } from "@/lib/project-query";
import { cn } from "@/lib/utils";

type TenantRecord = {
  id: string;
  proyectoId: string;
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  vigente: boolean;
  email: string | null;
  telefono: string | null;
};

type TenantForm = Omit<TenantRecord, "id">;

type TenantsCrudPanelProps = {
  projectId: string;
  canEdit: boolean;
  initialArrendatarios: TenantRecord[];
};

function createEmptyForm(projectId: string): TenantForm {
  return {
    proyectoId: projectId,
    rut: "",
    razonSocial: "",
    nombreComercial: "",
    vigente: true,
    email: null,
    telefono: null
  };
}

function toTenantRecord(value: Partial<TenantRecord>): TenantRecord {
  return {
    id: value.id ?? "",
    proyectoId: value.proyectoId ?? "",
    rut: value.rut ?? "",
    razonSocial: value.razonSocial ?? "",
    nombreComercial: value.nombreComercial ?? "",
    vigente: Boolean(value.vigente),
    email: value.email ?? null,
    telefono: value.telefono ?? null
  };
}

async function createTenant(form: TenantForm): Promise<TenantRecord> {
  const response = await fetch("/api/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form)
  });
  const data = (await response.json()) as Partial<TenantRecord> & { message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message ?? "No se pudo guardar el arrendatario.");
  }
  return toTenantRecord(data);
}

async function updateTenant(id: string, form: TenantForm): Promise<TenantRecord> {
  const query = buildProjectIdQueryString(form.proyectoId);
  const response = await fetch(`/api/tenants/${id}?${query}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form)
  });
  const data = (await response.json()) as Partial<TenantRecord> & { message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message ?? "No se pudo guardar el arrendatario.");
  }
  return toTenantRecord(data);
}

async function removeTenant(id: string, projectId: string): Promise<void> {
  const query = buildProjectIdQueryString(projectId);
  const response = await fetch(`/api/tenants/${id}?${query}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "No se pudo eliminar el arrendatario."));
  }
}

export function TenantsCrudPanel({
  projectId,
  canEdit,
  initialArrendatarios
}: TenantsCrudPanelProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<TenantForm>(createEmptyForm(projectId));

  const { data: tenants, status, error, isLoading, createOne, updateOne, deleteOne, resetStatus } =
    useCrudResource<TenantRecord, TenantForm, TenantForm>({
      initialData: initialArrendatarios,
      getId: (tenant) => tenant.id,
      create: createTenant,
      update: updateTenant,
      remove: (tenantId) => removeTenant(tenantId, projectId),
      sort: (a, b) => a.nombreComercial.localeCompare(b.nombreComercial, "es", { sensitivity: "base" })
    });

  const beginCreate = useCallback((): void => {
    setSelectedId(null);
    setFieldErrors({});
    setForm(createEmptyForm(projectId));
    resetStatus();
  }, [projectId, resetStatus]);

  const beginEdit = useCallback((item: TenantRecord): void => {
    setSelectedId(item.id);
    setFieldErrors({});
    setForm({
      proyectoId: item.proyectoId,
      rut: item.rut,
      razonSocial: item.razonSocial,
      nombreComercial: item.nombreComercial,
      vigente: item.vigente,
      email: item.email,
      telefono: item.telefono
    });
    resetStatus();
  }, [resetStatus]);

  const columns = useMemo<ColumnDef<TenantRecord, unknown>[]>(
    () => [
      {
        accessorKey: "rut",
        header: "RUT",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.rut}</span>
      },
      {
        accessorKey: "razonSocial",
        header: "Razon Social",
        enableColumnFilter: false,
        cell: ({ row }) => <span>{row.original.razonSocial}</span>
      },
      {
        accessorKey: "nombreComercial",
        header: "Nombre Comercial",
        filterFn: "includesString",
        cell: ({ row }) => <span className="font-medium">{row.original.nombreComercial}</span>
      },
      enumFilterColumn<TenantRecord>({
        id: "vigente",
        accessorFn: (row) => (row.vigente ? "Si" : "No"),
        header: "Vigente",
        options: ["Si", "No"],
        align: "center",
        cell: (row) => <span className="whitespace-nowrap">{row.vigente ? "Si" : "No"}</span>
      }),
      {
        accessorKey: "email",
        header: "Email",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.email ?? "-"}</span>
      },
      {
        accessorKey: "telefono",
        header: "Telefono",
        enableColumnFilter: false,
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.telefono ?? "-"}</span>
      },
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

  const { table } = useDataTable(tenants, columns);

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

    if (!form.razonSocial.trim()) {
      errors.razonSocial = "Razon social es obligatoria.";
    }
    if (!form.nombreComercial.trim()) {
      errors.nombreComercial = "Nombre comercial es obligatorio.";
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
      ? await updateOne(selectedId, form, "No se pudo guardar el arrendatario.")
      : await createOne(form, "No se pudo guardar el arrendatario.");

    if (!saved) {
      toast.error("No se pudo guardar el arrendatario.");
      return;
    }

    toast.success(
      selectedId ? "Arrendatario actualizado correctamente." : "Arrendatario creado correctamente."
    );
    beginCreate();
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDeleteId || !canEdit || isLoading) {
      return;
    }

    resetStatus();
    const deleted = await deleteOne(pendingDeleteId, "No se pudo eliminar el arrendatario.");
    if (!deleted) {
      toast.error("No se pudo eliminar el arrendatario.");
      return;
    }

    if (selectedId === pendingDeleteId) {
      beginCreate();
    }

    setPendingDeleteId(null);
    toast.success("Arrendatario eliminado correctamente.");
  }

  return (
    <>
      <EntityCrudShell
        title="CRUD de Arrendatarios"
        canEdit={canEdit}
        readOnlyMessage="Tu rol es de solo lectura para arrendatarios."
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
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  RUT <span className="text-xs text-slate-400">(opcional)</span>
                </span>
                <Input
                  value={form.rut}
                  onChange={(event) => {
                    setForm({ ...form, rut: event.target.value });
                    clearFieldError("rut");
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2",
                    fieldErrors.rut ? "border-rose-500" : "border-slate-300"
                  )}
                />
                {fieldErrors.rut ? <p className="mt-0.5 text-xs text-rose-600">{fieldErrors.rut}</p> : null}
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  Nombre comercial <span className="text-rose-500">*</span>
                </span>
                <Input
                  value={form.nombreComercial}
                  onChange={(event) => {
                    setForm({ ...form, nombreComercial: event.target.value });
                    clearFieldError("nombreComercial");
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2",
                    fieldErrors.nombreComercial ? "border-rose-500" : "border-slate-300"
                  )}
                />
                {fieldErrors.nombreComercial ? (
                  <p className="mt-0.5 text-xs text-rose-600">{fieldErrors.nombreComercial}</p>
                ) : null}
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-slate-700">
                  Razon social <span className="text-rose-500">*</span>
                </span>
                <Input
                  value={form.razonSocial}
                  onChange={(event) => {
                    setForm({ ...form, razonSocial: event.target.value });
                    clearFieldError("razonSocial");
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2",
                    fieldErrors.razonSocial ? "border-rose-500" : "border-slate-300"
                  )}
                />
                {fieldErrors.razonSocial ? (
                  <p className="mt-0.5 text-xs text-rose-600">{fieldErrors.razonSocial}</p>
                ) : null}
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  Email <span className="text-xs text-slate-400">(opcional)</span>
                </span>
                <Input
                  value={form.email ?? ""}
                  onChange={(event) => setForm({ ...form, email: event.target.value || null })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">
                  Telefono <span className="text-xs text-slate-400">(opcional)</span>
                </span>
                <Input
                  value={form.telefono ?? ""}
                  onChange={(event) => setForm({ ...form, telefono: event.target.value || null })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-700">Estado</span>
                <Select
                  value={form.vigente ? "ACTIVO" : "INACTIVO"}
                  onValueChange={(value) => setForm({ ...form, vigente: value === "ACTIVO" })}
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
            </div>

            <EntityFormSection
              mode={selectedId ? "edit" : "create"}
              canEdit={canEdit}
              isLoading={isLoading}
              onSubmit={() => {
                void handleSubmit();
              }}
              submitCreateLabel="Crear arrendatario"
              submitEditLabel="Actualizar arrendatario"
            />
          </div>
        }
        table={
          <>
            <DataTable
              table={table}
              emptyMessage="Aun no hay arrendatarios registrados. Completa el formulario de arriba para agregar el primero."
            />
            {tenants.length === 0 ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  onClick={beginCreate}
                  variant="default"
                  className="h-auto rounded-full px-3 py-1.5 text-xs"
                >
                  Crear primer arrendatario
                </Button>
              </div>
            ) : null}
          </>
        }
      />

      <ConfirmModal
        open={Boolean(pendingDeleteId)}
        title="Eliminar arrendatario"
        description="Se eliminara este arrendatario. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          void handleDelete();
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}
