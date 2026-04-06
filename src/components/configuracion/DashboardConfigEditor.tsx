"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ResolvedWidgetConfig, WidgetId } from "@/lib/dashboard/widget-registry";
import { getWidget, WIDGET_IDS } from "@/lib/dashboard/widget-registry";
import { CustomWidgetForm } from "./CustomWidgetForm";
import type { FormulaConfig } from "@/lib/dashboard/custom-widget-engine";
import { getFormulaDisplay } from "@/lib/dashboard/custom-widget-engine";

type CustomWidgetRow = {
  id: string;
  title: string;
  chartType: string;
  enabled: boolean;
  position: number;
  formulaConfig: FormulaConfig;
};

type Props = {
  initialConfigs: ResolvedWidgetConfig[];
  initialCustomWidgets: CustomWidgetRow[];
  canEdit: boolean;
};

const SECTION_LABELS: Record<string, string> = {
  ocupacion: "Ocupación",
  ingresos: "Ingresos del período",
  ggcc: "GGCC",
  cartera: "Estado de cartera",
  charts: "Gráficos (Rent Roll)",
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

export function DashboardConfigEditor({ initialConfigs, initialCustomWidgets, canEdit }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [configs, setConfigs] = useState<ResolvedWidgetConfig[]>(initialConfigs);
  const [saving, setSaving] = useState(false);
  const [customWidgets, setCustomWidgets] = useState<CustomWidgetRow[]>(initialCustomWidgets);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingSaving, setAddingSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function updateConfig(widgetId: WidgetId, patch: Partial<ResolvedWidgetConfig>) {
    setConfigs((prev) =>
      prev.map((c) => (c.widgetId === widgetId ? { ...c, ...patch } : c))
    );
  }

  function moveUp(widgetId: WidgetId) {
    setConfigs((prev) => {
      const idx = prev.findIndex((c) => c.widgetId === widgetId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((c, i) => ({ ...c, position: i }));
    });
  }

  function moveDown(widgetId: WidgetId) {
    setConfigs((prev) => {
      const idx = prev.findIndex((c) => c.widgetId === widgetId);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((c, i) => ({ ...c, position: i }));
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          configs.map((c) => ({
            widgetId: c.widgetId,
            enabled: c.enabled,
            position: c.position,
            formulaVariant: c.formulaVariant || null,
            parameters: Object.keys(c.parameters).length > 0 ? c.parameters : null,
          }))
        ),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Error al guardar configuración."));
      }

      toast.success("Configuración guardada.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCustomWidget(payload: {
    title: string;
    chartType: string;
    formulaConfig: FormulaConfig;
  }) {
    setAddingSaving(true);
    try {
      const response = await fetch("/api/custom-widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, position: customWidgets.length }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Error al crear widget."));
      }
      const created = (await response.json()) as CustomWidgetRow;
      setCustomWidgets((prev) => [...prev, created]);
      setShowAddForm(false);
      toast.success("Widget creado.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setAddingSaving(false);
    }
  }

  async function handleToggleCustomWidget(id: string, enabled: boolean) {
    setCustomWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled } : w))
    );
    try {
      const response = await fetch(`/api/custom-widgets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Error al actualizar."));
      }
      startTransition(() => router.refresh());
    } catch (error) {
      setCustomWidgets((prev) =>
        prev.map((w) => (w.id === id ? { ...w, enabled: !enabled } : w))
      );
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    }
  }

  async function handleDeleteCustomWidget(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/custom-widgets/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Error al eliminar."));
      }
      setCustomWidgets((prev) => prev.filter((w) => w.id !== id));
      toast.success("Widget eliminado.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setDeletingId(null);
    }
  }

  // Group by section, preserving order within each section
  const sections = Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>;
  const bySection = new Map<string, ResolvedWidgetConfig[]>();
  for (const section of sections) {
    bySection.set(
      section,
      configs.filter((c) => getWidget(c.widgetId).section === section)
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const sectionConfigs = bySection.get(section) ?? [];
        if (sectionConfigs.length === 0) return null;

        return (
          <div key={section} className="rounded-md bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                {SECTION_LABELS[section]}
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {sectionConfigs.map((cfg, idx) => {
                const widget = getWidget(cfg.widgetId);
                const allInSection = sectionConfigs.length;

                return (
                  <div
                    key={cfg.widgetId}
                    className={cn(
                      "flex flex-col gap-3 px-4 py-3 transition-colors",
                      !cfg.enabled && "opacity-50"
                    )}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3">
                      {/* Toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={cfg.enabled}
                        disabled={!canEdit}
                        onClick={() => updateConfig(cfg.widgetId, { enabled: !cfg.enabled })}
                        className={cn(
                          "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                          cfg.enabled ? "bg-brand-500" : "bg-slate-300",
                          !canEdit && "cursor-not-allowed"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                            cfg.enabled ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>

                      {/* Title */}
                      <span className="flex-1 text-sm font-medium text-slate-800">
                        {widget.title}
                      </span>

                      {/* Reorder buttons */}
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveUp(cfg.widgetId)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Subir"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx === allInSection - 1}
                            onClick={() => moveDown(cfg.widgetId)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Bajar"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Formula variant selector */}
                    {canEdit && widget.formulaVariants && widget.formulaVariants.length > 0 && (
                      <div className="ml-12 flex items-center gap-2">
                        <label className="text-xs text-slate-500">Variante de fórmula:</label>
                        <select
                          value={cfg.formulaVariant}
                          onChange={(e) =>
                            updateConfig(cfg.widgetId, { formulaVariant: e.target.value })
                          }
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-300"
                        >
                          {widget.formulaVariants.map((v) => (
                            <option key={v.id} value={v.id} title={v.description}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-400">
                          {widget.formulaVariants.find((v) => v.id === cfg.formulaVariant)
                            ?.description ?? ""}
                        </span>
                      </div>
                    )}

                    {/* Parameter inputs */}
                    {canEdit && widget.parameters && widget.parameters.length > 0 && (
                      <div className="ml-12 flex flex-wrap gap-4">
                        {widget.parameters.map((param) => (
                          <div key={param.key} className="flex items-center gap-2">
                            <label className="text-xs text-slate-500">{param.label}:</label>
                            {param.type === "boolean" ? (
                              <input
                                type="checkbox"
                                checked={Boolean(cfg.parameters[param.key] ?? param.defaultValue)}
                                onChange={(e) =>
                                  updateConfig(cfg.widgetId, {
                                    parameters: { ...cfg.parameters, [param.key]: e.target.checked },
                                  })
                                }
                                className="h-4 w-4 rounded border-slate-300 text-brand-500"
                              />
                            ) : (
                              <input
                                type="number"
                                min={param.min}
                                max={param.max}
                                value={Number(cfg.parameters[param.key] ?? param.defaultValue)}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (!Number.isFinite(val)) return;
                                  updateConfig(cfg.widgetId, {
                                    parameters: { ...cfg.parameters, [param.key]: val },
                                  });
                                }}
                                className="w-20 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-300"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Custom Widgets section */}
      <div className="rounded-md bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            Widgets Personalizados
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="rounded-md border border-brand-300 bg-white px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              {showAddForm ? "Cancelar" : "+ Nuevo widget"}
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100 px-4">
          {customWidgets.length === 0 && !showAddForm && (
            <p className="py-4 text-sm text-slate-400">
              No hay widgets personalizados. {canEdit && "Crea uno con el botón de arriba."}
            </p>
          )}

          {customWidgets.map((w) => (
            <div
              key={w.id}
              className={cn(
                "flex items-center gap-3 py-3",
                !w.enabled && "opacity-50"
              )}
            >
              {/* Toggle */}
              {canEdit && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={w.enabled}
                  onClick={() => handleToggleCustomWidget(w.id, !w.enabled)}
                  className={cn(
                    "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                    w.enabled ? "bg-brand-500" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                      w.enabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              )}

              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{w.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {getFormulaDisplay(w.formulaConfig)} · {w.chartType}
                </p>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDeleteCustomWidget(w.id)}
                  disabled={deletingId === w.id}
                  className="rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  title="Eliminar widget"
                >
                  {deletingId === w.id ? "…" : "✕"}
                </button>
              )}
            </div>
          ))}

          {showAddForm && canEdit && (
            <div className="py-3">
              <CustomWidgetForm
                onSubmit={handleAddCustomWidget}
                onCancel={() => setShowAddForm(false)}
                saving={addingSaving}
              />
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
        </div>
      )}

      {!canEdit && (
        <p className="text-sm text-slate-500">
          Solo los usuarios con rol ADMIN u OPERACIONES pueden modificar esta configuración.
        </p>
      )}
    </div>
  );
}

// Re-export types needed by the page
export type { ResolvedWidgetConfig };
export { WIDGET_IDS };
