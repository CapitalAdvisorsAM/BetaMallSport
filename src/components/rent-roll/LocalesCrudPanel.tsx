"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type LocalTipo =
  | "LOCAL_COMERCIAL"
  | "SIMULADOR"
  | "MODULO"
  | "ESPACIO"
  | "BODEGA"
  | "OTRO";
type EstadoMaestro = "ACTIVO" | "INACTIVO";

type LocalRecord = {
  id: string;
  proyectoId: string;
  codigo: string;
  nombre: string;
  glam2: string;
  piso: string;
  tipo: LocalTipo;
  zona: string | null;
  esGLA: boolean;
  estado: EstadoMaestro;
};

type LocalForm = Omit<LocalRecord, "id">;

type LocalesCrudPanelProps = {
  proyectoId: string;
  canEdit: boolean;
  initialLocales: LocalRecord[];
};

function createEmptyForm(proyectoId: string): LocalForm {
  return {
    proyectoId,
    codigo: "",
    nombre: "",
    glam2: "",
    piso: "",
    tipo: "LOCAL_COMERCIAL",
    zona: null,
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
    zona: value.zona ?? null,
    esGLA: Boolean(value.esGLA),
    estado: value.estado ?? "ACTIVO"
  };
}

function formatDecimal(value: string): string {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return parsed.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function LocalesCrudPanel({
  proyectoId,
  canEdit,
  initialLocales
}: LocalesCrudPanelProps): JSX.Element {
  const [locales, setLocales] = useState<LocalRecord[]>(initialLocales);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<LocalForm>(createEmptyForm(proyectoId));

  const filteredLocales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return locales;
    }
    return locales.filter((local) =>
      [local.codigo, local.nombre, local.piso, local.zona ?? "", local.tipo].join(" ").toLowerCase().includes(q)
    );
  }, [locales, search]);

  function beginCreate(): void {
    setSelectedId(null);
    setFieldErrors({});
    setForm(createEmptyForm(proyectoId));
  }

  function beginEdit(local: LocalRecord): void {
    setSelectedId(local.id);
    setFieldErrors({});
    setForm({
      proyectoId: local.proyectoId,
      codigo: local.codigo,
      nombre: local.nombre,
      glam2: local.glam2,
      piso: local.piso,
      tipo: local.tipo,
      zona: local.zona,
      esGLA: local.esGLA,
      estado: local.estado
    });
  }

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
    if (!String(form.glam2).trim()) {
      errors.glam2 = "GLA m2 es obligatorio.";
    }
    if (!form.piso.trim()) {
      errors.piso = "Piso es obligatorio.";
    }

    return errors;
  }

  async function handleSubmit(): Promise<void> {
    if (!canEdit || loading) {
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setMessageType("error");
      setMessage("Corrige los campos marcados.");
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setMessage(null);
    setMessageType(null);
    try {
      const isEditing = Boolean(selectedId);
      const response = await fetch(isEditing ? `/api/locales/${selectedId}` : "/api/locales", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as Partial<LocalRecord> & { message?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? "No se pudo guardar el local.");
      }

      const saved = toLocalRecord(data);
      if (isEditing) {
        setLocales((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
        setMessageType("success");
        setMessage("Local actualizado correctamente.");
      } else {
        setLocales((previous) =>
          [...previous, saved].sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { sensitivity: "base" }))
        );
        setMessageType("success");
        setMessage("Local creado correctamente.");
      }
      beginCreate();
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Error inesperado al guardar local.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(localId: string): Promise<void> {
    if (!canEdit || loading) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setMessageType(null);
    try {
      const response = await fetch(`/api/locales/${localId}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "No se pudo eliminar el local.");
      }

      setLocales((previous) => previous.filter((item) => item.id !== localId));
      if (selectedId === localId) {
        beginCreate();
      }
      setMessageType("success");
      setMessage("Local eliminado correctamente.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Error inesperado al eliminar local.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">CRUD de Locales</h3>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar local"
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

      {!canEdit ? <p className="text-sm text-amber-700">Tu rol es de solo lectura para locales.</p> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Codigo <span className="text-rose-500">*</span>
          </span>
          <input
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
          <input
            value={form.nombre}
            onChange={(event) => setForm({ ...form, nombre: event.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            GLA m2 <span className="text-rose-500">*</span>
          </span>
          <input
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
          <input
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
          <select
            value={form.tipo}
            onChange={(event) => setForm({ ...form, tipo: event.target.value as LocalTipo })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="LOCAL_COMERCIAL">LOCAL COMERCIAL</option>
            <option value="SIMULADOR">SIMULADOR</option>
            <option value="MODULO">MODULO</option>
            <option value="ESPACIO">ESPACIO</option>
            <option value="BODEGA">BODEGA</option>
            <option value="OTRO">OTRO</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Zona <span className="text-xs text-slate-400">(opcional)</span>
          </span>
          <input
            value={form.zona ?? ""}
            onChange={(event) => setForm({ ...form, zona: event.target.value || null })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Estado <span className="text-rose-500">*</span>
          </span>
          <select
            value={form.estado}
            onChange={(event) => setForm({ ...form, estado: event.target.value as EstadoMaestro })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.esGLA}
            onChange={(event) => setForm({ ...form, esGLA: event.target.checked })}
          />
          Es GLA
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canEdit || loading}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="mr-1.5 inline h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Guardando…
            </>
          ) : selectedId ? (
            "Actualizar local"
          ) : (
            "Crear local"
          )}
        </button>
      </div>

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={cn("text-sm", messageType === "error" ? "text-rose-600" : "text-emerald-700")}
        >
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-brand-700">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Codigo
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Nombre
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Piso
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Tipo
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                GLA m2
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Estado
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-800">
            {filteredLocales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  {search.trim() ? (
                    <p className="text-sm text-slate-500">Sin resultados para «{search.trim()}»</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700">Aún no hay locales registrados</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Completa el formulario de arriba para agregar el primero.
                      </p>
                      <button
                        type="button"
                        onClick={beginCreate}
                        className="mt-3 rounded-full border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        Crear primer local
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              filteredLocales.map((local, index) => (
                <tr
                  key={local.id}
                  className={cn(
                    "transition-colors hover:bg-brand-50",
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{local.codigo}</td>
                  <td className="px-4 py-3">{local.nombre}</td>
                  <td className="whitespace-nowrap px-4 py-3">{local.piso}</td>
                  <td className="whitespace-nowrap px-4 py-3">{local.tipo}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDecimal(local.glam2)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{local.estado}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(local)}
                        disabled={!canEdit}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(local.id)}
                        disabled={!canEdit || loading}
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
      <ConfirmModal
        open={Boolean(pendingDeleteId)}
        title="Eliminar local"
        description="Se eliminara este local. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (pendingDeleteId) {
            void handleDelete(pendingDeleteId);
            setPendingDeleteId(null);
          }
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </section>
  );
}
