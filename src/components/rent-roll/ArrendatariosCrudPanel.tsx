"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ArrendatarioRecord = {
  id: string;
  proyectoId: string;
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  vigente: boolean;
  email: string | null;
  telefono: string | null;
};

type ArrendatarioForm = Omit<ArrendatarioRecord, "id">;

type ArrendatariosCrudPanelProps = {
  proyectoId: string;
  canEdit: boolean;
  initialArrendatarios: ArrendatarioRecord[];
};

function createEmptyForm(proyectoId: string): ArrendatarioForm {
  return {
    proyectoId,
    rut: "",
    razonSocial: "",
    nombreComercial: "",
    vigente: true,
    email: null,
    telefono: null
  };
}

function toArrendatarioRecord(value: Partial<ArrendatarioRecord>): ArrendatarioRecord {
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

export function ArrendatariosCrudPanel({
  proyectoId,
  canEdit,
  initialArrendatarios
}: ArrendatariosCrudPanelProps): JSX.Element {
  const [arrendatarios, setArrendatarios] = useState<ArrendatarioRecord[]>(initialArrendatarios);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ArrendatarioForm>(createEmptyForm(proyectoId));

  const filteredArrendatarios = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return arrendatarios;
    }
    return arrendatarios.filter((item) =>
      [item.rut, item.nombreComercial, item.razonSocial, item.email ?? "", item.telefono ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [arrendatarios, search]);

  function beginCreate(): void {
    setSelectedId(null);
    setForm(createEmptyForm(proyectoId));
  }

  function beginEdit(item: ArrendatarioRecord): void {
    setSelectedId(item.id);
    setForm({
      proyectoId: item.proyectoId,
      rut: item.rut,
      razonSocial: item.razonSocial,
      nombreComercial: item.nombreComercial,
      vigente: item.vigente,
      email: item.email,
      telefono: item.telefono
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
      const response = await fetch(isEditing ? `/api/arrendatarios/${selectedId}` : "/api/arrendatarios", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = (await response.json()) as Partial<ArrendatarioRecord> & { message?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? "No se pudo guardar el arrendatario.");
      }

      const saved = toArrendatarioRecord(data);
      if (isEditing) {
        setArrendatarios((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
        setMessage("Arrendatario actualizado correctamente.");
      } else {
        setArrendatarios((previous) =>
          [...previous, saved].sort((a, b) =>
            a.nombreComercial.localeCompare(b.nombreComercial, "es", { sensitivity: "base" })
          )
        );
        setMessage("Arrendatario creado correctamente.");
      }
      beginCreate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al guardar arrendatario.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(tenantId: string): Promise<void> {
    if (!canEdit || loading) {
      return;
    }
    if (!window.confirm("Se eliminara este arrendatario. Esta accion no se puede deshacer.")) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/arrendatarios/${tenantId}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "No se pudo eliminar el arrendatario.");
      }

      setArrendatarios((previous) => previous.filter((item) => item.id !== tenantId));
      if (selectedId === tenantId) {
        beginCreate();
      }
      setMessage("Arrendatario eliminado correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error inesperado al eliminar arrendatario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">CRUD de Arrendatarios</h3>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar arrendatario"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={beginCreate}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            Nuevo
          </button>
        </div>
      </div>

      {!canEdit ? <p className="text-sm text-amber-700">Tu rol es de solo lectura para arrendatarios.</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">RUT</span>
          <input
            value={form.rut}
            onChange={(event) => setForm({ ...form, rut: event.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Nombre comercial</span>
          <input
            value={form.nombreComercial}
            onChange={(event) => setForm({ ...form, nombreComercial: event.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block text-slate-700">Razon social</span>
          <input
            value={form.razonSocial}
            onChange={(event) => setForm({ ...form, razonSocial: event.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Email</span>
          <input
            value={form.email ?? ""}
            onChange={(event) => setForm({ ...form, email: event.target.value || null })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Telefono</span>
          <input
            value={form.telefono ?? ""}
            onChange={(event) => setForm({ ...form, telefono: event.target.value || null })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.vigente}
            onChange={(event) => setForm({ ...form, vigente: event.target.checked })}
          />
          Vigente
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canEdit || loading}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selectedId ? "Actualizar arrendatario" : "Crear arrendatario"}
        </button>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-brand-700">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Nombre comercial
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Razon social
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                RUT
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Email
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Telefono
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Vigente
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-800">
            {filteredArrendatarios.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No se encontraron arrendatarios.
                </td>
              </tr>
            ) : (
              filteredArrendatarios.map((item, index) => (
                <tr
                  key={item.id}
                  className={cn(
                    "transition-colors hover:bg-brand-50",
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                  )}
                >
                  <td className="px-4 py-3 font-medium">{item.nombreComercial}</td>
                  <td className="px-4 py-3">{item.razonSocial}</td>
                  <td className="whitespace-nowrap px-4 py-3">{item.rut}</td>
                  <td className="whitespace-nowrap px-4 py-3">{item.email ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{item.telefono ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{item.vigente ? "Si" : "No"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(item)}
                        disabled={!canEdit}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        disabled={!canEdit}
                        className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
