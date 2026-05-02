"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  AccountingGroupOptions,
  AccountingRecordPatchPayload,
  AccountingRecordRow,
} from "@/types/accounting-records";
import { useAccountingRecordsApi } from "@/hooks/useAccountingRecordsApi";
import { Button } from "@/components/ui/button";
import { cn, formatDecimal, formatPeriodoCorto } from "@/lib/utils";

type Filters = {
  period: string;
  group1: string;
  search: string;
  onlyEdited: boolean;
};

type EditableField = "valueUf" | "group1" | "group3" | "unitId" | "tenantId";

type EditingCell = {
  id: string;
  field: EditableField;
  value: string;
};

type RefOption = { id: string; nombre: string };

type Props = { projectId: string };

export function AccountingRecordsTable({ projectId }: Props): JSX.Element {
  const api = useAccountingRecordsApi();

  const [rows, setRows] = useState<AccountingRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    period: "",
    group1: "",
    search: "",
    onlyEdited: false,
  });

  // Reference data loaded once on mount
  const [groupOptions, setGroupOptions] = useState<AccountingGroupOptions>({
    group1: [],
    group3ByGroup1: {},
  });
  const [unitList, setUnitList] = useState<RefOption[]>([]);
  const [tenantList, setTenantList] = useState<RefOption[]>([]);

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load reference data once on mount
  useEffect(() => {
    void Promise.all([
      api.fetchGroupOptions(projectId, "REAL"),
      api.fetchUnits(projectId),
      api.fetchTenants(projectId),
    ]).then(([opts, units, tenants]) => {
      setGroupOptions(opts);
      setUnitList(units);
      setTenantList(tenants);
    });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const res = await api.fetchRecords({
          projectId,
          period: filters.period || undefined,
          group1: filters.group1 || undefined,
          search: filters.search || undefined,
          onlyEdited: filters.onlyEdited || undefined,
          scenario: "REAL",
          cursor,
          limit: 50,
        });

        setRows((prev) => (cursor ? [...prev, ...res.data] : res.data));
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar registros.");
      } finally {
        setLoading(false);
      }
    },
    [projectId, filters] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Reset and reload when filters change
  useEffect(() => {
    setRows([]);
    setNextCursor(null);
    void load();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input when editing a number cell
  useEffect(() => {
    if (editingCell?.field === "valueUf") {
      window.setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editingCell]);

  function handleFilterChange(key: keyof Filters, value: string | boolean): void {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setEditingCell(null);
  }

  function startEdit(row: AccountingRecordRow, field: EditableField): void {
    const value =
      field === "unitId"   ? (row.unitId   ?? "") :
      field === "tenantId" ? (row.tenantId ?? "") :
      row[field];
    setEditingCell({ id: row.id, field, value });
  }

  function cancelEdit(): void {
    setEditingCell(null);
  }

  async function commitEdit(overrideValue?: string): Promise<void> {
    if (!editingCell) return;

    const value = overrideValue ?? editingCell.value;
    const row = rows.find((r) => r.id === editingCell.id);

    // No-op if unchanged
    const currentValue =
      editingCell.field === "unitId"   ? (row?.unitId   ?? "") :
      editingCell.field === "tenantId" ? (row?.tenantId ?? "") :
      row?.[editingCell.field] ?? "";

    if (!row || value === currentValue) {
      setEditingCell(null);
      return;
    }

    setSavingId(editingCell.id);
    setEditingCell(null);

    try {
      let payload: AccountingRecordPatchPayload;
      if (editingCell.field === "valueUf")        payload = { valueUf: value };
      else if (editingCell.field === "group1")    payload = { group1: value };
      else if (editingCell.field === "group3")    payload = { group3: value };
      else if (editingCell.field === "unitId")    payload = { unitId: value || null };
      else                                        payload = { tenantId: value || null };

      const updated = await api.patchRecord(editingCell.id, payload);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success("Guardado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSavingId(null);
    }
  }

  const totalEdited = rows.filter((r) => r.isManuallyEdited).length;

  return (
    <div className="space-y-3">
      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={filters.period}
          onChange={(e) => handleFilterChange("period", e.target.value)}
          className="h-8 rounded-md border border-surface-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Período"
        />

        {/* Filter uses complete group1 list from group-options endpoint */}
        <select
          value={filters.group1}
          onChange={(e) => handleFilterChange("group1", e.target.value)}
          className="h-8 max-w-[220px] rounded-md border border-surface-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Todas las secciones</option>
          {groupOptions.group1.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={filters.search}
          onChange={(e) => handleFilterChange("search", e.target.value)}
          placeholder="Buscar local / arrendatario / descripción…"
          className="h-8 w-60 rounded-md border border-surface-200 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 select-none">
          <input
            type="checkbox"
            checked={filters.onlyEdited}
            onChange={(e) => handleFilterChange("onlyEdited", e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-500"
          />
          Solo editados
          {totalEdited > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              {totalEdited}
            </span>
          )}
        </label>

        {loading && (
          <span className="text-[11px] text-slate-400 animate-pulse">Cargando…</span>
        )}
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-md border border-surface-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-200 bg-brand-700 text-left">
              {["Período", "Local", "Arrendatario", "Sección", "Línea", "Descripción", "Valor UF", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2 font-semibold text-white/90 whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {filters.period || filters.group1 || filters.search || filters.onlyEdited
                    ? "No hay registros con estos filtros."
                    : "Selecciona un período para ver los registros contables."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSaving = savingId === row.id;
                const isEditingField = (field: EditableField) =>
                  editingCell?.id === row.id && editingCell.field === field;

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-surface-100 transition-colors",
                      row.isManuallyEdited ? "bg-amber-50/40" : "bg-white hover:bg-surface-50"
                    )}
                  >
                    {/* Período */}
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-500">
                      {formatPeriodoCorto(row.period)}
                    </td>

                    {/* Local */}
                    <td className="px-3 py-1.5 max-w-[140px]">
                      {isEditingField("unitId") ? (
                        <select
                          autoFocus
                          value={editingCell?.value ?? ""}
                          onChange={(e) => void commitEdit(e.target.value)}
                          onBlur={cancelEdit}
                          className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">— Sin asignar —</option>
                          {unitList.map((u) => (
                            <option key={u.id} value={u.id}>{u.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <EditableCell
                          value={row.unitNombre ?? row.externalUnit ?? "—"}
                          disabled={isSaving}
                          onClick={() => startEdit(row, "unitId")}
                        />
                      )}
                    </td>

                    {/* Arrendatario */}
                    <td className="px-3 py-1.5 max-w-[140px]">
                      {isEditingField("tenantId") ? (
                        <select
                          autoFocus
                          value={editingCell?.value ?? ""}
                          onChange={(e) => void commitEdit(e.target.value)}
                          onBlur={cancelEdit}
                          className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="">— Sin asignar —</option>
                          {tenantList.map((t) => (
                            <option key={t.id} value={t.id}>{t.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <EditableCell
                          value={row.tenantNombre ?? row.externalTenant ?? "—"}
                          disabled={isSaving}
                          onClick={() => startEdit(row, "tenantId")}
                        />
                      )}
                    </td>

                    {/* Sección (group1) */}
                    <td className="px-3 py-1.5 max-w-[160px]">
                      {isEditingField("group1") ? (
                        <select
                          autoFocus
                          value={editingCell?.value ?? ""}
                          onChange={(e) => void commitEdit(e.target.value)}
                          onBlur={cancelEdit}
                          className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {groupOptions.group1.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <EditableCell
                          value={row.group1}
                          disabled={isSaving}
                          onClick={() => startEdit(row, "group1")}
                          muted
                        />
                      )}
                    </td>

                    {/* Línea (group3) */}
                    <td className="px-3 py-1.5 max-w-[160px]">
                      {isEditingField("group3") ? (
                        <select
                          autoFocus
                          value={editingCell?.value ?? ""}
                          onChange={(e) => void commitEdit(e.target.value)}
                          onBlur={cancelEdit}
                          className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {(groupOptions.group3ByGroup1[row.group1] ?? []).map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <EditableCell
                          value={row.group3}
                          disabled={isSaving}
                          onClick={() => startEdit(row, "group3")}
                        />
                      )}
                    </td>

                    {/* Descripción — not editable */}
                    <td className="px-3 py-1.5 max-w-[180px]">
                      <span className="block truncate text-slate-400" title={row.denomination}>
                        {row.denomination}
                      </span>
                    </td>

                    {/* Valor UF — editable inline via number input */}
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {isEditingField("valueUf") ? (
                        <input
                          ref={inputRef}
                          type="number"
                          step="0.0001"
                          value={editingCell?.value ?? ""}
                          onChange={(e) =>
                            setEditingCell((prev) =>
                              prev ? { ...prev, value: e.target.value } : null
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          onBlur={() => void commitEdit()}
                          className="w-28 rounded border border-brand-400 bg-white px-2 py-0.5 text-right text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row, "valueUf")}
                          disabled={isSaving}
                          className={cn(
                            "group relative rounded px-1.5 py-0.5 font-mono tabular-nums transition-colors",
                            isSaving
                              ? "text-slate-300"
                              : "text-slate-700 hover:bg-brand-50 hover:text-brand-700 cursor-text"
                          )}
                          title="Clic para editar"
                        >
                          {isSaving ? "…" : formatDecimal(row.valueUf)}
                          {!isSaving && (
                            <span className="absolute -top-0.5 -right-0.5 hidden group-hover:inline text-[9px] text-brand-400">
                              ✏
                            </span>
                          )}
                        </button>
                      )}

                      {row.isManuallyEdited && row.originalValueUf && !isEditingField("valueUf") && (
                        <div className="mt-0.5 text-[10px] text-amber-600" title="Valor original">
                          orig: {formatDecimal(row.originalValueUf)}
                        </div>
                      )}
                    </td>

                    {/* Badge de estado */}
                    <td className="px-3 py-1.5 text-center">
                      {row.isManuallyEdited && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          editado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Paginación ── */}
      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(nextCursor ?? undefined)}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Cargar más"}
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <p className="text-right text-[11px] text-slate-400">
          {rows.length} registro{rows.length !== 1 ? "s" : ""}
          {totalEdited > 0
            ? ` · ${totalEdited} editado${totalEdited !== 1 ? "s" : ""} manualmente`
            : ""}
        </p>
      )}
    </div>
  );
}

// ── Shared editable cell display ──────────────────────────────────────────────

type EditableCellProps = {
  value: string;
  disabled: boolean;
  onClick: () => void;
  muted?: boolean;
};

function EditableCell({ value, disabled, onClick, muted = false }: EditableCellProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative block w-full truncate rounded px-1.5 py-0.5 text-left transition-colors",
        disabled
          ? "text-slate-300 cursor-default"
          : muted
          ? "text-slate-500 hover:bg-brand-50 hover:text-brand-700 cursor-text"
          : "text-slate-700 hover:bg-brand-50 hover:text-brand-700 cursor-text"
      )}
      title={disabled ? undefined : "Clic para editar"}
    >
      <span className="block truncate">{value}</span>
      {!disabled && (
        <span className="absolute -top-0.5 -right-0.5 hidden group-hover:inline text-[9px] text-brand-400">
          ✏
        </span>
      )}
    </button>
  );
}
