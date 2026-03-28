"use client";

import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
  const pathname = usePathname();
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
      const response = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, color })
      });
      const data = (await response.json()) as ProjectResponse;
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? "No se pudo crear el proyecto.");
      }

      const targetUrl = `${pathname}?proyecto=${encodeURIComponent(data.id)}`;
      router.push(targetUrl);
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
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Nombre del proyecto</span>
            <input
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej: Mall Sport Providencia"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500 focus:ring-2"
              required
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-700">Color</span>
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-[42px] w-full rounded-lg border border-slate-300 px-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="self-end rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear proyecto"}
          </button>
        </form>
      )}

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </main>
  );
}
