"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...ggcc, createEmptyGgccItem()])}
          className="h-auto px-2 py-1 text-sm"
        >
          + Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {ggcc.map((item, index) => (
          <div key={item._key} className="grid gap-2 md:grid-cols-5">
            <Input
              type="number"
              step="any"
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
            <Input
              type="number"
              step="any"
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
            <Input
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
            <Input
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
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() => onChange(ggcc.filter((_, i) => i !== index))}
              className="h-auto px-2 py-2 text-sm"
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
