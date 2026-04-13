"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  PERIODO_FIELD_CATALOG,
  getFormulaDisplay,
  type PeriodoField,
  type DisplayFormat,
  type FormulaConfig,
} from "@/lib/dashboard/custom-widget-engine";

const FIELDS = Object.entries(PERIODO_FIELD_CATALOG) as Array<
  [PeriodoField, { label: string; defaultFormat: DisplayFormat }]
>;

const OPERATORS = [
  { value: "+", label: "+" },
  { value: "-", label: "−" },
  { value: "*", label: "×" },
  { value: "/", label: "÷" },
] as const;

const FORMAT_OPTIONS: Array<{ value: DisplayFormat; label: string }> = [
  { value: "number", label: "Número" },
  { value: "uf", label: "UF" },
  { value: "percent", label: "Porcentaje (%)" },
  { value: "m2", label: "Metros cuadrados (m²)" },
  { value: "months", label: "Meses" },
];

const CHART_TYPES = [
  { value: "line", label: "Línea" },
  { value: "bar", label: "Barras" },
  { value: "area", label: "Área" },
  { value: "kpi", label: "Tarjeta KPI" },
];

type FormState = {
  title: string;
  chartType: "line" | "bar" | "area" | "kpi";
  formulaType: "single" | "binary";
  field: PeriodoField;
  fieldA: PeriodoField;
  operator: "+" | "-" | "*" | "/";
  fieldB: PeriodoField;
  format: DisplayFormat;
};

type Props = {
  onSubmit: (payload: {
    title: string;
    chartType: string;
    formulaConfig: FormulaConfig;
  }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
};

export function CustomWidgetForm({ onSubmit, onCancel, saving }: Props) {
  const [form, setForm] = useState<FormState>({
    title: "",
    chartType: "line",
    formulaType: "single",
    field: "pctOcupacionGLA",
    fieldA: "pctOcupacionGLA",
    operator: "/",
    fieldB: "glaArrendadaM2",
    format: "percent",
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-suggest format when field changes
      if (key === "field") {
        next.format = PERIODO_FIELD_CATALOG[value as PeriodoField].defaultFormat;
      }
      if (key === "fieldA") {
        next.format = PERIODO_FIELD_CATALOG[value as PeriodoField].defaultFormat;
      }
      return next;
    });
  }

  function buildFormulaConfig(): FormulaConfig {
    if (form.formulaType === "single") {
      return { type: "single", field: form.field, format: form.format };
    }
    return {
      type: "binary",
      fieldA: form.fieldA,
      operator: form.operator,
      fieldB: form.fieldB,
      format: form.format,
    };
  }

  const previewText = getFormulaDisplay(buildFormulaConfig());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit({
      title: form.title.trim(),
      chartType: form.chartType,
      formulaConfig: buildFormulaConfig(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-brand-200 bg-brand-50 p-4">
      <h4 className="text-sm font-semibold text-brand-700">Nuevo widget personalizado</h4>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Título</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Ej: GLA Vacante histórica"
          required
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
        />
      </div>

      {/* Chart type */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Tipo de gráfico</label>
        <div className="flex gap-2">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => update("chartType", ct.value as "line" | "bar" | "area" | "kpi")}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                form.chartType === ct.value
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
              )}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formula type toggle */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Tipo de fórmula</label>
        <div className="flex gap-2">
          {(["single", "binary"] as const).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => update("formulaType", ft)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                form.formulaType === ft
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
              )}
            >
              {ft === "single" ? "Campo único" : "Operación entre campos"}
            </button>
          ))}
        </div>
      </div>

      {/* Field selector(s) */}
      {form.formulaType === "single" ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Campo</label>
          <select
            value={form.field}
            onChange={(e) => update("field", e.target.value as PeriodoField)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
          >
            {FIELDS.map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Campo A</label>
            <select
              value={form.fieldA}
              onChange={(e) => update("fieldA", e.target.value as PeriodoField)}
              className="rounded-md border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
            >
              {FIELDS.map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Op.</label>
            <select
              value={form.operator}
              onChange={(e) => update("operator", e.target.value as FormState["operator"])}
              className="w-14 rounded-md border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Campo B</label>
            <select
              value={form.fieldB}
              onChange={(e) => update("fieldB", e.target.value as PeriodoField)}
              className="rounded-md border border-slate-200 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
            >
              {FIELDS.map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Format */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600">Formato de visualización</label>
        <select
          value={form.format}
          onChange={(e) => update("format", e.target.value as DisplayFormat)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
        >
          {FORMAT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Preview */}
      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-700">Vista previa de fórmula:</span> {previewText}
      </p>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !form.title.trim()}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Agregando…" : "Agregar widget"}
        </button>
      </div>
    </form>
  );
}
