"use client";

import type { ContractFormPayload } from "@/types";

export type GgccListItem = ContractFormPayload["ggcc"][number] & { _key: string };

type GgccListEditorProps = {
  ggcc: GgccListItem[];
  onChange: (updated: GgccListItem[]) => void;
  disabled?: boolean;
};

export function createEmptyGgccItem(): GgccListItem {
  return {
    _key: crypto.randomUUID(),
    tarifaBaseUfM2: "",
    pctAdministracion: "",
    vigenciaDesde: "",
    vigenciaHasta: null,
    proximoReajuste: null
  };
}

export function GgccListEditor({
  ggcc,
  onChange,
  disabled = false
}: GgccListEditorProps): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">GGCC</h4>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...ggcc, createEmptyGgccItem()])}
          className="text-sm font-medium text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Agregar
        </button>
      </div>
      <div className="space-y-2">
        {ggcc.map((item, index) => (
          <div key={item._key} className="grid gap-2 md:grid-cols-5">
            <input
              placeholder="Tarifa base UF/m2"
              disabled={disabled}
              value={item.tarifaBaseUfM2}
              onChange={(event) => {
                const next = [...ggcc];
                next[index] = { ...item, tarifaBaseUfM2: event.target.value };
                onChange(next);
              }}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
            <input
              placeholder="% administracion"
              disabled={disabled}
              value={item.pctAdministracion}
              onChange={(event) => {
                const next = [...ggcc];
                next[index] = { ...item, pctAdministracion: event.target.value };
                onChange(next);
              }}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
            <input
              type="date"
              disabled={disabled}
              value={item.vigenciaDesde}
              onChange={(event) => {
                const next = [...ggcc];
                next[index] = { ...item, vigenciaDesde: event.target.value };
                onChange(next);
              }}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
            <input
              type="date"
              disabled={disabled}
              value={item.vigenciaHasta ?? ""}
              onChange={(event) => {
                const next = [...ggcc];
                next[index] = { ...item, vigenciaHasta: event.target.value || null };
                onChange(next);
              }}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(ggcc.filter((_, i) => i !== index))}
              className="rounded-md border border-rose-200 px-2 py-2 text-sm text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
