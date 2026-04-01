"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type ProjectRecord = {
  id: string;
  nombre: string;
  slug: string;
  color: string;
  activo: boolean;
};

type ProjectForm = {
  nombre: string;
  color: string;
  activo: boolean;
};

type ProjectCrudPanelProps = {
  canEdit: boolean;
  initialProjects: ProjectRecord[];
};

function emptyForm(): ProjectForm {
  return {
    nombre: "",
    color: "#0f766e",
    activo: true
  };
}

function toProjectRecord(value: Partial<ProjectRecord>): ProjectRecord {
  return {
    id: value.id ?? "",
    nombre: value.nombre ?? "",
    slug: value.slug ?? "",
    color: value.color ?? "#0f766e",
    activo: Boolean(value.activo)
  };
}

export function ProjectCrudPanel({ canEdit, initialProjects }: ProjectCrudPanelProps): JSX.Element {
  const [projects, setProjects] = useState<ProjectRecord[]>(initialProjects);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm());

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return projects;
    }
    return projects.filter((project) =>
      [project.nombre, project.slug, project.color, project.activo ? "activo" : "inactivo"]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [projects, search]);

  function beginCreate(): void {
    setSelectedId(null);
    setForm(emptyForm());
  }

  function beginEdit(project: ProjectRecord): void {
    setSelectedId(project.id);
    setForm({
      nombre: project.nombre,
      color: project.color,
      activo: project.activo
    });
  }

  async function handleSubmit(): Promise<void> {
    if (!canEdit || loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const isEditing = Boolean(selectedId);
      const response = await fetch(isEditing ? `/api/proyectos/${selectedId}` : "/api/proyectos", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = (await response.json()) as Partial<ProjectRecord> & { message?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? "No se pudo guardar el proyecto.");
      }

      const saved = toProjectRecord(data);
      if (isEditing) {
        setProjects((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
        setMessage("Proyecto actualizado correctamente.");
      } else {
        setProjects((previous) =>
          [...previous, saved].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
        );
        setMessage("Proyecto creado correctamente.");
      }
      beginCreate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al guardar proyecto.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(projectId: string): Promise<void> {
    if (!canEdit || loading) {
      return;
    }
    if (!window.confirm("Se eliminara el proyecto si no tiene datos asociados. Continuar?")) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/proyectos/${projectId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("No se pudo eliminar el proyecto.");
      }

      setProjects((previous) => previous.filter((item) => item.id !== projectId));
      if (selectedId === projectId) {
        beginCreate();
      }
      setMessage("Proyecto eliminado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al eliminar proyecto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">CRUD de Proyectos</h3>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar proyecto"
            className="h-10 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={beginCreate}
            className="h-auto px-3 py-2 text-sm"
          >
            Nuevo
          </Button>
        </div>
      </div>

      {!canEdit ? <p className="text-sm text-amber-700">Tu rol es de solo lectura para proyectos.</p> : null}

      <div className="grid gap-3 md:grid-cols-[1fr_200px_160px]">
        <div className="text-sm">
          <Label htmlFor="project-name" className="mb-1 block text-slate-700">
            Nombre
          </Label>
          <Input
            id="project-name"
            value={form.nombre}
            onChange={(event) => setForm({ ...form, nombre: event.target.value })}
            className="w-full"
          />
        </div>
        <div className="text-sm">
          <Label htmlFor="project-color" className="mb-1 block text-slate-700">
            Color
          </Label>
          <Input
            id="project-color"
            type="color"
            value={form.color}
            onChange={(event) => setForm({ ...form, color: event.target.value })}
            className="h-10 w-full px-2"
          />
        </div>
        <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
          <Checkbox
            checked={form.activo}
            onCheckedChange={(value) => setForm({ ...form, activo: value === true })}
          />
          Activo
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="default"
          onClick={() => void handleSubmit()}
          disabled={!canEdit || loading}
          className="rounded-full"
        >
          {selectedId ? "Actualizar proyecto" : "Crear proyecto"}
        </Button>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <Table className="min-w-full divide-y divide-slate-200">
          <TableHeader className="bg-brand-700">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Nombre
              </TableHead>
              <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Slug
              </TableHead>
              <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Color
              </TableHead>
              <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Estado
              </TableHead>
              <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm text-slate-800">
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No se encontraron proyectos.
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project, index) => (
                <TableRow
                  key={project.id}
                  className={cn(
                    "transition-colors hover:bg-brand-50",
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                  )}
                >
                  <TableCell className="px-4 py-3 font-medium">{project.nombre}</TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3 text-slate-600">{project.slug}</TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border border-slate-300"
                        style={{ backgroundColor: project.color }}
                      />
                      {project.color}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        project.activo
                          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                          : "border-slate-300 bg-slate-200 text-slate-700"
                      }
                    >
                      {project.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => beginEdit(project)}
                        disabled={!canEdit}
                        className="h-auto px-2 py-1 text-xs"
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void handleDelete(project.id)}
                        disabled={!canEdit}
                        className="h-auto px-2 py-1 text-xs"
                        >
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
