"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDataTable } from "@/hooks/useDataTable";

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

export function ProjectCrudPanel({ canEdit, initialProjects }: ProjectCrudPanelProps): JSX.Element {
  const [projects, setProjects] = useState<ProjectRecord[]>(initialProjects);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#0f766e");
  const [activo, setActivo] = useState(true);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      [p.nombre, p.slug, p.color, p.activo ? "activo" : "inactivo"].join(" ").toLowerCase().includes(q)
    );
  }, [projects, search]);

  async function handleCreate(): Promise<void> {
    if (!canEdit || loading) return;

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, color, activo })
      });

      const data = (await response.json()) as Partial<ProjectRecord> & { message?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? "No se pudo crear el proyecto.");
      }

      const saved: ProjectRecord = {
        id: data.id,
        nombre: data.nombre ?? "",
        slug: data.slug ?? "",
        color: data.color ?? "#0f766e",
        activo: Boolean(data.activo)
      };

      setProjects((prev) =>
        [...prev, saved].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
      );
      setMessage("Proyecto creado correctamente.");
      setNombre("");
      setColor("#0f766e");
      setActivo(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al crear proyecto.");
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = useCallback(
    async (projectId: string): Promise<void> => {
      if (!canEdit || loading) return;
      if (!window.confirm("Se eliminara el proyecto si no tiene datos asociados. Continuar?")) return;

      setLoading(true);
      setMessage(null);
      try {
        const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
        if (!response.ok) throw new Error("No se pudo eliminar el proyecto.");

        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        setMessage("Proyecto eliminado correctamente.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Error inesperado al eliminar proyecto.");
      } finally {
        setLoading(false);
      }
    },
    [canEdit, loading]
  );

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
      {
        id: "activo",
        accessorFn: (row) => (row.activo ? "Activo" : "Inactivo"),
        header: "Estado",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: ["Activo", "Inactivo"], align: "center" },
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.activo
                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                : "border-slate-300 bg-slate-200 text-slate-700"
            }
          >
            {row.original.activo ? "Activo" : "Inactivo"}
          </Badge>
        )
      },
      {
        id: "acciones",
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="ghost" disabled={!canEdit} className="h-auto px-2 py-1 text-xs">
              <Link href={`/configuracion/proyecto?proyecto=${row.original.id}`}>Configurar</Link>
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete(row.original.id)}
              disabled={!canEdit || loading}
              className="h-auto px-2 py-1 text-xs"
            >
              Eliminar
            </Button>
          </div>
        )
      }
    ],
    [canEdit, handleDelete, loading]
  );

  const { table } = useDataTable(filteredProjects, columns);

  return (
    <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Proyectos</h3>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar proyecto"
          className="h-10 w-56 text-sm"
        />
      </div>

      {!canEdit ? (
        <p className="text-sm text-amber-700">Tu rol es de solo lectura para proyectos.</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1fr_200px_auto_auto]">
        <div className="space-y-1.5 text-sm">
          <Label htmlFor="new-project-name">Nombre</Label>
          <Input
            id="new-project-name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
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
            onChange={(e) => setColor(e.target.value)}
            disabled={!canEdit}
            className="h-10 w-full px-2"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-7 text-sm text-slate-700">
          <Checkbox
            checked={activo}
            onCheckedChange={(v) => setActivo(v === true)}
            disabled={!canEdit}
          />
          Activo
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!canEdit || loading || nombre.trim().length < 2}
          >
            Crear proyecto
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <DataTable table={table} emptyMessage="No se encontraron proyectos." />
    </section>
  );
}
