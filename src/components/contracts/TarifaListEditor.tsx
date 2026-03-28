"use client";

import type { ContractFormPayload } from "@/types";

export type TarifaListItem = ContractFormPayload["tarifas"][number] & { _key: string };

type TarifaListEditorProps = {
  tarifas: TarifaListItem[];
  onChange: (updated: TarifaListItem[]) => void;
  disabled?: boolean;
};

export function createEmptyTarifaItem(): TarifaListItem {
  return {
    _key: crypto.randomUUID(),
    tipo: "FIJO_UF_M2",
    valor: "",
    vigenciaDesde: "",
    vigenciaHasta: null,
    esDiciembre: false
  };
}

export function TarifaListEditor({
  tarifas,
  onChange,
  disabled = false
}: TarifaListEditorProps): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Tarifas</h4>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...tarifas, createEmptyTarifaItem()])}
          className="text-sm font-medium text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Agregar
        </button>
      </div>
      <div className="space-y-2">
        {tarifas.map((tarifa, index) => (
          <div key={tarifa._key} className="grid gap-2 md:grid-cols-5">
            <select
              value={tarifa.tipo}
              disabled={disabled}
              onChange={(event) => {
                const next = [...tarifas];
                next[index] = {
                  ...tarifa,
                  tipo: event.target.value as ContractFormPayload["tarifas"][0]["tipo"]
                };
                onChange(next);
              }}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="FIJO_UF_M2">FIJO_UF_M2</option>
              <option value="FIJO_UF">FIJO_UF</option>
              <option value="PORCENTAJE">PORCENTAJE</option>
            </select>
            <input
              placeholder="Valor"
              disabled={disabled}
              value={tarifa.valor}
              onChange={(event) => {
                const next = [...tarifas];
                next[index] = { ...tarifa, valor: event.target.value };
                onChange(next);
              }}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
            <input
              type="date"
              disabled={disabled}
              value={tarifa.vigenciaDesde}
              onChange={(event) => {
                const next = [...tarifas];
                next[index] = { ...tarifa, vigenciaDesde: event.target.value };
                onChange(next);
              }}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
            <input
              type="date"
              disabled={disabled}
              value={tarifa.vigenciaHasta ?? ""}
              onChange={(event) => {
                const next = [...tarifas];
                next[index] = { ...tarifa, vigenciaHasta: event.target.value || null };
                onChange(next);
              }}
              className="rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                const next = tarifas.filter((_, i) => i !== index);
                onChange(next.length > 0 ? next : [createEmptyTarifaItem()]);
              }}
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
