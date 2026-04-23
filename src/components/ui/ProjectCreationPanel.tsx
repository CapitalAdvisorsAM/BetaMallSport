"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type ProjectCreationPanelProps = {
  title: string;
  description: string;
  canEdit: boolean;
};

type ProjectResponse = {
  id?: string;
  message?: string;
};

export function ProjectCreationPanel({
  title,
  description,
  canEdit
}: ProjectCreationPanelProps): JSX.Element {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#0f766e");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canEdit || loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, color })
      });
      const data = (await response.json()) as ProjectResponse;
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? "No se pudo crear el proyecto.");
      }

      router.push("/plan/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al crear proyecto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-4 rounded-md bg-white p-6 shadow-sm">
      <header>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">{title}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </header>

      {!canEdit ? (
        <p className="text-sm text-amber-700">
          Tu rol es de solo lectura. Solicita permisos de escritura para crear proyectos.
        </p>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <FormField label="Nombre del proyecto" htmlFor="project-name" required>
            <Input
              id="project-name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej: Mall Sport Providencia"
              className="w-full"
              required
            />
          </FormField>
          <FormField label="Color" htmlFor="project-color">
            <Input
              id="project-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-10 w-full px-2"
            />
          </FormField>
          <Button
            type="submit"
            variant="default"
            disabled={loading}
            className="self-end rounded-full"
          >
            {loading ? "Creando..." : "Crear proyecto"}
          </Button>
        </form>
      )}

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </main>
  );
}
