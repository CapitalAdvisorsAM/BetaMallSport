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

export function createEmptyRentaVariableItem(umbralVentasUf = ""): RentaVariableListItem {
  return {
    _key: crypto.randomUUID(),
    pctRentaVariable: "",
    umbralVentasUf,
    vigenciaDesde: "",
    vigenciaHasta: null
  };
}

export function RentaVariableListEditor({
  items,
  onChange,
  disabled = false
}: RentaVariableListEditorProps): JSX.Element {
  function handleAdd() {
    if (items.length === 0) {
      onChange([createEmptyRentaVariableItem("0")]);
    } else {
      onChange([...items, createEmptyRentaVariableItem()]);
    }
  }

  function handleRemove(key: string) {
    const next = items.filter((item) => item._key !== key);
    onChange(next);
  }

  function handleChange(key: string, field: "pctRentaVariable" | "umbralVentasUf", value: string) {
    onChange(
      items.map((item) => (item._key === key ? { ...item, [field]: value } : item))
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Renta variable (%)</h4>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={handleAdd}
          className="h-auto px-2 py-1 text-sm"
        >
          + Agregar tramo
        </Button>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        El % del tramo alcanzado se aplica sobre todas las ventas. El primer tramo (umbral 0) es la base.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Sin renta variable configurada.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item._key} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="Umbral ventas UF"
                disabled={disabled || index === 0}
                value={item.umbralVentasUf}
                onChange={(event) => handleChange(item._key, "umbralVentasUf", event.target.value)}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <Input
                placeholder="% renta variable"
                disabled={disabled}
                value={item.pctRentaVariable}
                onChange={(event) => handleChange(item._key, "pctRentaVariable", event.target.value)}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <Button
                type="button"
                variant="destructive"
                disabled={disabled}
                onClick={() => handleRemove(item._key)}
                className="h-auto px-2 py-2 text-sm"
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
