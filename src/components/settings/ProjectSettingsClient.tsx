"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ProjectRecord = {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
  slug: string;
  glaTotal: string | null;
};

type ProjectSettingsClientProps = {
  project: ProjectRecord;
  canEdit: boolean;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return fallback;
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function ProjectSettingsClient({
  project,
  canEdit,
}: ProjectSettingsClientProps): JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState(project.nombre);
  const [color, setColor] = useState(project.color);
  const [activo, setActivo] = useState(project.activo);
  const [glaTotal, setGlaTotal] = useState(project.glaTotal ?? "");

  async function handleSave(): Promise<void> {
    if (!canEdit || saving) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, color, activo, glaTotal: glaTotal.trim() || null })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "No se pudo guardar el proyecto."));
      }

      toast.success("Proyecto actualizado correctamente.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Configuración del Proyecto"
        description="Edita el nombre, color y estado del proyecto seleccionado."
      />

      <ModuleSectionCard>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <Label htmlFor="config-nombre">Nombre</Label>
              <Input
                id="config-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={!canEdit}
                placeholder="Nombre del proyecto"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="config-color">Color</Label>
              <Input
                id="config-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={!canEdit}
                className="h-10 w-full px-2"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="config-gla-total">GLA Teórica Total (m²)</Label>
            <Input
              id="config-gla-total"
              type="number"
              step="0.01"
              min="0"
              value={glaTotal}
              onChange={(e) => setGlaTotal(e.target.value)}
              disabled={!canEdit}
              placeholder="Ej: 12500.00"
              className="max-w-xs"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <Checkbox
              checked={activo}
              onCheckedChange={(v) => setActivo(v === true)}
              disabled={!canEdit}
            />
            Proyecto activo
          </label>

          {!canEdit ? (
            <p className="text-sm text-amber-700">Tu rol es de solo lectura. No puedes editar el proyecto.</p>
          ) : null}

          <div>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canEdit || saving}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>

          <p className="text-xs text-slate-400">
            Slug actual: <span className="font-mono">{project.slug}</span>
            {nombre !== project.nombre ? " — se regenerará al guardar" : ""}
          </p>
        </div>
      </ModuleSectionCard>
    </main>
  );
}
