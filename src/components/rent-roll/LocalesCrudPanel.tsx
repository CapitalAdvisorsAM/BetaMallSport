"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { cn, formatDecimal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/Spinner";
import { useDataTable } from "@/hooks/useDataTable";

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

function parseDecimal(value: string): number | undefined {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<LocalForm>(createEmptyForm(proyectoId));
  const glam2Missing = !String(form.glam2).trim();

  const filteredLocales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return locales;
    }
    return locales.filter((local) =>
      [local.codigo, local.nombre, local.piso, local.zona ?? "", local.tipo].join(" ").toLowerCase().includes(q)
    );
  }, [locales, search]);

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
      {
        accessorKey: "tipo",
        header: "Tipo",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: {
          filterType: "enum",
          filterOptions: ["LOCAL_COMERCIAL", "SIMULADOR", "MODULO", "ESPACIO", "BODEGA", "OTRO"]
        },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.tipo}</span>
      },
      {
        accessorKey: "piso",
        header: "Piso",
        enableColumnFilter: false,
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.piso}</span>
      },
      {
        accessorKey: "zona",
        header: "Zona",
        enableColumnFilter: false,
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.zona ?? "-"}</span>
      },
      {
        id: "glam2",
        accessorFn: (row) => parseDecimal(row.glam2),
        header: "GLA m2",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDecimal(row.original.glam2)}</span>
      },
      {
        id: "esGLA",
        accessorFn: (row) => (row.esGLA ? 1 : 0),
        header: "Es GLA",
        enableColumnFilter: false,
        meta: { align: "center" },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.esGLA ? "Si" : "No"}</span>
      },
      {
        accessorKey: "estado",
        header: "Estado",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: ["ACTIVO", "INACTIVO"] },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.estado}</span>
      },
      {
        id: "acciones",
        accessorFn: (row) => row.id,
        header: "Acciones",
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => beginEdit(row.original)}
              disabled={!canEdit}
              className="h-auto px-2 py-1 text-xs"
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setPendingDeleteId(row.original.id)}
              disabled={!canEdit || loading}
              className="h-auto px-2 py-1 text-xs"
            >
              Eliminar
            </Button>
          </div>
        )
      }
    ],
    [canEdit, loading]
  );

  const { table } = useDataTable(filteredLocales, columns);

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
      toast.warning("Corrige los campos marcados.");
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const isEditing = Boolean(selectedId);
      const editQuery = `?proyectoId=${encodeURIComponent(form.proyectoId)}`;
      const response = await fetch(
        isEditing ? `/api/locales/${selectedId}${editQuery}` : "/api/locales",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        }
      );
      const data = (await response.json()) as Partial<LocalRecord> & { message?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? "No se pudo guardar el local.");
      }

      const saved = toLocalRecord(data);
      if (isEditing) {
        setLocales((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
        toast.success("Local actualizado correctamente.");
      } else {
        setLocales((previous) =>
          [...previous, saved].sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { sensitivity: "base" }))
        );
        toast.success("Local creado correctamente.");
      }
      beginCreate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al guardar local.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(localId: string): Promise<void> {
    if (!canEdit || loading) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/locales/${localId}?proyectoId=${encodeURIComponent(proyectoId)}`,
        { method: "DELETE" }
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "No se pudo eliminar el local.");
      }

      setLocales((previous) => previous.filter((item) => item.id !== localId));
      if (selectedId === localId) {
        beginCreate();
      }
      toast.success("Local eliminado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al eliminar local.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">CRUD de Locales</h3>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar local"
            className="w-48"
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

      {!canEdit ? <p className="text-sm text-amber-700">Tu rol es de solo lectura para locales.</p> : null}

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
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Zona <span className="text-xs text-slate-400">(opcional)</span>
          </span>
          <Input
            value={form.zona ?? ""}
            onChange={(event) => setForm({ ...form, zona: event.target.value || null })}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">
            Estado <span className="text-rose-500">*</span>
          </span>
          <Select
            value={form.estado}
            onValueChange={(value) => setForm({ ...form, estado: value as EstadoMaestro })}
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

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="default"
          onClick={() => void handleSubmit()}
          disabled={!canEdit || loading}
          className="rounded-full"
        >
          {loading ? (
            <>
              <Spinner className="mr-1.5" />
              Guardando…
            </>
          ) : selectedId ? (
            "Actualizar local"
          ) : (
            "Crear local"
          )}
        </Button>
      </div>

      <DataTable
        table={table}
        emptyMessage={
          search.trim()
            ? `Sin resultados para "${search.trim()}"`
            : "Aun no hay locales registrados. Completa el formulario de arriba para agregar el primero."
        }
      />
      {filteredLocales.length === 0 && !search.trim() ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="default"
            onClick={beginCreate}
            className="h-auto rounded-full px-3 py-1.5 text-xs"
          >
            Crear primer local
          </Button>
        </div>
      ) : null}
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
