"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContractFormPayload } from "@/types";

export type RentaVariableListItem = ContractFormPayload["rentaVariable"][number] & { _key: string };

type RentaVariableListEditorProps = {
  items: RentaVariableListItem[];
  onChange: (updated: RentaVariableListItem[]) => void;
  disabled?: boolean;
  fechasContrato?: { inicio: string; termino: string };
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
  disabled = false,
  fechasContrato
}: RentaVariableListEditorProps): JSX.Element {
  const canUseContractDates = Boolean(fechasContrato?.inicio && fechasContrato?.termino);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Renta variable (%)</h4>
        <div className="flex items-center gap-2">
          {canUseContractDates ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || items.length === 0}
              onClick={() => {
                if (!fechasContrato) {
                  return;
                }

                const next = items.map((item) => ({
                  ...item,
                  vigenciaDesde: item.vigenciaDesde || fechasContrato.inicio,
                  vigenciaHasta: item.vigenciaHasta || fechasContrato.termino
                }));
                onChange(next);
              }}
              className="h-auto px-2 py-1 text-sm"
            >
              Usar fechas del contrato
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange([...items, createEmptyRentaVariableItem()])}
            className="h-auto px-2 py-1 text-sm"
          >
            + Agregar
          </Button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Sin tramos de renta variable.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item._key} className="grid gap-2 md:grid-cols-4">
              <Input
                placeholder="% renta variable"
                disabled={disabled}
                value={item.pctRentaVariable}
                onChange={(event) => {
                  const next = [...items];
                  next[index] = { ...item, pctRentaVariable: event.target.value };
                  onChange(next);
                }}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <Input
                type="date"
                disabled={disabled}
                value={item.vigenciaDesde}
                onChange={(event) => {
                  const next = [...items];
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
                  const next = [...items];
                  next[index] = { ...item, vigenciaHasta: event.target.value || null };
                  onChange(next);
                }}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <Button
                type="button"
                variant="destructive"
                disabled={disabled}
                onClick={() => {
                  const next = items.filter((_, i) => i !== index);
                  onChange(next);
                }}
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
