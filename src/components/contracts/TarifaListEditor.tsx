"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
        <h4 className="text-sm font-semibold text-slate-900">Tarifas fijas</h4>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...tarifas, createEmptyTarifaItem()])}
          className="h-auto px-2 py-1 text-sm"
        >
          + Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {tarifas.map((tarifa, index) => (
          <div key={tarifa._key} className="grid gap-2 md:grid-cols-5">
            <Select
              value={tarifa.tipo}
              disabled={disabled}
              onValueChange={(value) => {
                const next = [...tarifas];
                next[index] = {
                  ...tarifa,
                  tipo: value as ContractFormPayload["tarifas"][0]["tipo"]
                };
                onChange(next);
              }}
            >
              <SelectTrigger className="rounded-md px-2 py-2 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIJO_UF_M2">FIJO_UF_M2</SelectItem>
                <SelectItem value="FIJO_UF">FIJO_UF</SelectItem>
              </SelectContent>
            </Select>
            <Input
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
            <Input
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
            <Input
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
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() => {
                const next = tarifas.filter((_, i) => i !== index);
                onChange(next.length > 0 ? next : [createEmptyTarifaItem()]);
              }}
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
