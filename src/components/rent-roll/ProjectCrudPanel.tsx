"use client";

import { useCallback, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { EntityActionsCell } from "@/components/crud/EntityActionsCell";
import { EntityCrudShell } from "@/components/crud/EntityCrudShell";
import { EntityFormSection } from "@/components/crud/EntityFormSection";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { statusBadgeColumn } from "@/components/ui/data-table-columns";
import { useCrudResource } from "@/hooks/useCrudResource";
import { useDataTable } from "@/hooks/useDataTable";
import { extractApiErrorMessage } from "@/lib/http/client-errors";

type ProjectRecord = {
  id: string;
  nombre: string;
  slug: string;
  color: string;
  activo: boolean;
};

type ProjectCrudPanelProps = {
  canEdit: boolean;
  initialProjects: ProjectRecord[];
};

type ProjectCreatePayload = {
  nombre: string;
  color: string;
  activo: boolean;
};

async function createProject(payload: ProjectCreatePayload): Promise<ProjectRecord> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = (await response.json()) as Partial<ProjectRecord> & { message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message ?? "No se pudo crear el proyecto.");
  }

  return {
    id: data.id,
    nombre: data.nombre ?? "",
    slug: data.slug ?? "",
    color: data.color ?? "#0f766e",
    activo: Boolean(data.activo)
  };
}

async function updateProject(id: string, payload: ProjectCreatePayload): Promise<ProjectRecord> {
  const response = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = (await response.json()) as Partial<ProjectRecord> & { message?: string };
  if (!response.ok || !data.id) {
    throw new Error(data.message ?? "No se pudo actualizar el proyecto.");
  }

  return {
    id: data.id,
    nombre: data.nombre ?? "",
    slug: data.slug ?? "",
    color: data.color ?? "#0f766e",
    activo: Boolean(data.activo)
  };
}

async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "No se pudo eliminar el proyecto."));
  }
}

export function ProjectCrudPanel({ canEdit, initialProjects }: ProjectCrudPanelProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#0f766e");
  const [activo, setActivo] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: projects, createOne, deleteOne, isLoading, error, resetStatus } = useCrudResource<
    ProjectRecord,
    ProjectCreatePayload,
    ProjectCreatePayload
  >({
    initialData: initialProjects,
    getId: (project) => project.id,
    create: createProject,
    update: updateProject,
    remove: deleteProject,
    sort: (a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  });

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return projects;
    }

    return projects.filter((project) =>
      [project.nombre, project.slug, project.color, project.activo ? "activo" : "inactivo"]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [projects, search]);

  const handleCreate = useCallback(async (): Promise<void> => {
    if (!canEdit || isLoading || nombre.trim().length < 2) {
      return;
    }

    resetStatus();
    setMessage(null);

    const created = await createOne(
      { nombre: nombre.trim(), color, activo },
      "No se pudo crear el proyecto."
    );
    if (!created) {
      return;
    }

    setMessage("Proyecto creado correctamente.");
    setNombre("");
    setColor("#0f766e");
    setActivo(true);
  }, [activo, canEdit, color, createOne, isLoading, nombre, resetStatus]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!pendingDeleteId || !canEdit || isLoading) {
      return;
    }

    resetStatus();
    setMessage(null);
    const deleted = await deleteOne(pendingDeleteId, "No se pudo eliminar el proyecto.");
    if (deleted) {
      setMessage("Proyecto eliminado correctamente.");
    }
    setPendingDeleteId(null);
  }, [canEdit, deleteOne, isLoading, pendingDeleteId, resetStatus]);

  const columns = useMemo<ColumnDef<ProjectRecord, unknown>[]>(
    () => [
      {
        accessorKey: "nombre",
        header: "Nombre",
        filterFn: "includesString",
        cell: ({ row }) => <span className="font-medium">{row.original.nombre}</span>
      },
      {
        accessorKey: "slug",
        header: "Slug",
        filterFn: "includesString",
        cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{row.original.slug}</span>
      },
      {
        accessorKey: "color",
        header: "Color",
        enableColumnFilter: false,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span
              className="h-3 w-3 rounded-full border border-slate-300"
              style={{ backgroundColor: row.original.color }}
            />
            {row.original.color}
          </span>
        )
      },
      statusBadgeColumn<ProjectRecord>({
        id: "activo",
        accessorFn: (row) => (row.activo ? "Activo" : "Inactivo"),
        header: "Estado",
        options: ["Activo", "Inactivo"],
        getValue: (row) => (row.activo ? "Activo" : "Inactivo"),
        getClassName: (value) =>
          value === "Activo"
            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
            : "border-slate-300 bg-slate-200 text-slate-700"
      }),
      {
        id: "acciones",
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <EntityActionsCell
            canEdit={canEdit}
            loading={isLoading}
            configureHref={`/configuracion/proyecto?proyecto=${row.original.id}`}
            onDelete={() => setPendingDeleteId(row.original.id)}
          />
        )
      }
    ],
    [canEdit, isLoading]
  );

  const { table } = useDataTable(filteredProjects, columns);

  return (
    <>
      <EntityCrudShell
        title="Proyectos"
        canEdit={canEdit}
        readOnlyMessage="Tu rol es de solo lectura para proyectos."
        toolbar={
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar proyecto"
            className="h-10 w-56 text-sm"
          />
        }
        message={error ?? message}
        form={
          <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
            <div className="space-y-1.5 text-sm">
              <Label htmlFor="new-project-name">Nombre</Label>
              <Input
                id="new-project-name"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Nombre del nuevo proyecto"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5 text-sm">
              <Label htmlFor="new-project-color">Color</Label>
              <Input
                id="new-project-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                disabled={!canEdit}
                className="h-10 w-full px-2"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-7 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={activo}
                onChange={(event) => setActivo(event.target.checked)}
                disabled={!canEdit}
                className="h-4 w-4 rounded border-slate-300"
              />
              Activo
            </label>

            <div className="md:col-span-3">
              <EntityFormSection
                mode="create"
                canEdit={canEdit}
                isLoading={isLoading}
                onSubmit={() => void handleCreate()}
                submitCreateLabel="Crear proyecto"
                submitEditLabel="Actualizar proyecto"
              />
            </div>
          </div>
        }
        table={<DataTable table={table} emptyMessage="No se encontraron proyectos." />}
      />

      <ConfirmModal
        open={Boolean(pendingDeleteId)}
        title="Eliminar proyecto"
        description="Se eliminara el proyecto si no tiene datos asociados. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          void handleDelete();
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}
