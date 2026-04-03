"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContractFormPayload } from "@/types";

export type RentaVariableListItem = ContractFormPayload["rentaVariable"][number] & { _key: string };

type RentaVariableListEditorProps = {
  items: RentaVariableListItem[];
  onChange: (updated: RentaVariableListItem[]) => void;
  disabled?: boolean;
};

export function createEmptyRentaVariableItem(): RentaVariableListItem {
  return {
    _key: crypto.randomUUID(),
    pctRentaVariable: "",
    vigenciaDesde: "",
    vigenciaHasta: null
  };
}

export function RentaVariableListEditor({
  items,
  onChange,
  disabled = false
}: RentaVariableListEditorProps): JSX.Element {
  const currentItem = items[0] ?? null;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Renta variable (%)</h4>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || Boolean(currentItem)}
            onClick={() => onChange([...items, createEmptyRentaVariableItem()])}
            className="h-auto px-2 py-1 text-sm"
          >
            + Agregar
          </Button>
        </div>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        La renta variable usa automaticamente las fechas del contrato.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Sin renta variable configurada.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            placeholder="% renta variable"
            disabled={disabled}
            value={currentItem?.pctRentaVariable ?? ""}
            onChange={(event) => {
              if (!currentItem) {
                return;
              }
              onChange([{ ...currentItem, pctRentaVariable: event.target.value }]);
            }}
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={disabled}
            onClick={() => onChange([])}
            className="h-auto px-2 py-2 text-sm"
          >
            Quitar
          </Button>
        </div>
      )}
    </div>
  );
}
