"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  const columns = useMemo<ColumnDef<ArrendatarioRecord, unknown>[]>(
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
      {
        id: "vigente",
        accessorFn: (row) => (row.vigente ? "Si" : "No"),
        header: "Vigente",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterType: "enum", filterOptions: ["Si", "No"], align: "center" },
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.vigente ? "Si" : "No"}</span>
      },
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

  const { table } = useDataTable(filteredArrendatarios, columns);

  function beginCreate(): void {
    setSelectedId(null);
    setFieldErrors({});
    setForm(createEmptyForm(proyectoId));
  }

  function beginEdit(item: ArrendatarioRecord): void {
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

    if (!form.razonSocial.trim()) {
      errors.razonSocial = "Razon social es obligatoria.";
    }
    if (!form.nombreComercial.trim()) {
      errors.nombreComercial = "Nombre comercial es obligatorio.";
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
        isEditing ? `/api/arrendatarios/${selectedId}${editQuery}` : "/api/arrendatarios",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        }
      );

      const data = (await response.json()) as Partial<ArrendatarioRecord> & { message?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.message ?? "No se pudo guardar el arrendatario.");
      }

      const saved = toArrendatarioRecord(data);
      if (isEditing) {
        setArrendatarios((previous) => previous.map((item) => (item.id === saved.id ? saved : item)));
        toast.success("Arrendatario actualizado correctamente.");
      } else {
        setArrendatarios((previous) =>
          [...previous, saved].sort((a, b) =>
            a.nombreComercial.localeCompare(b.nombreComercial, "es", { sensitivity: "base" })
          )
        );
        toast.success("Arrendatario creado correctamente.");
      }
      beginCreate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al guardar arrendatario.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(tenantId: string): Promise<void> {
    if (!canEdit || loading) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/arrendatarios/${tenantId}?proyectoId=${encodeURIComponent(proyectoId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("No se pudo eliminar el arrendatario.");
      }

      setArrendatarios((previous) => previous.filter((item) => item.id !== tenantId));
      if (selectedId === tenantId) {
        beginCreate();
      }
      toast.success("Arrendatario eliminado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado al eliminar arrendatario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">CRUD de Arrendatarios</h3>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar arrendatario"
            className="w-56"
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

      {!canEdit ? <p className="text-sm text-amber-700">Tu rol es de solo lectura para arrendatarios.</p> : null}

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
            "Actualizar arrendatario"
          ) : (
            "Crear arrendatario"
          )}
        </Button>
      </div>

      <DataTable
        table={table}
        emptyMessage={
          search.trim()
            ? `Sin resultados para "${search.trim()}"`
            : "Aun no hay arrendatarios registrados. Completa el formulario de arriba para agregar el primero."
        }
      />
      {filteredArrendatarios.length === 0 && !search.trim() ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="default"
            onClick={beginCreate}
            className="h-auto rounded-full px-3 py-1.5 text-xs"
          >
            Crear primer arrendatario
          </Button>
        </div>
      ) : null}
      <ConfirmModal
        open={Boolean(pendingDeleteId)}
        title="Eliminar arrendatario"
        description="Se eliminara este arrendatario. Esta accion no se puede deshacer."
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
