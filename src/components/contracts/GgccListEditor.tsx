"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContractFormPayload } from "@/types";

export type GgccListItem = ContractFormPayload["ggcc"][number] & { _key: string };

type GgccListEditorProps = {
  ggcc: GgccListItem[];
  onChange: (updated: GgccListItem[]) => void;
  disabled?: boolean;
  fechasContrato?: { inicio: string; termino: string };
};

export function createEmptyGgccItem(): GgccListItem {
  return {
    _key: crypto.randomUUID(),
    tarifaBaseUfM2: "0",
    pctAdministracion: "0",
    pctReajuste: null,
    vigenciaDesde: "",
    vigenciaHasta: null,
    proximoReajuste: null,
    mesesReajuste: null
  };
}

export function GgccListEditor({
  ggcc,
  onChange,
  disabled = false,
  fechasContrato
}: GgccListEditorProps): JSX.Element {
  const canUseContractDates = Boolean(fechasContrato?.inicio && fechasContrato?.termino);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">GGCC</h4>
        <div className="flex items-center gap-2">
          {canUseContractDates ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || ggcc.length === 0}
              onClick={() => {
                if (!fechasContrato) {
                  return;
                }
                const next = ggcc.map((item) => ({
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
            onClick={() => onChange([...ggcc, createEmptyGgccItem()])}
            className="h-auto px-2 py-1 text-sm"
          >
            + Agregar
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {ggcc.map((item, index) => (
          <div key={item._key} className="space-y-1.5">
            <div className="grid gap-2 md:grid-cols-4">
              <Input
                type="number"
                step="any"
                placeholder="Tarifa base UF/m²"
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
            <div className="flex items-center gap-3 pl-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`reajuste-${item._key}`}
                  checked={item.mesesReajuste !== null}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    const next = [...ggcc];
                    next[index] = {
                      ...item,
                      mesesReajuste: checked ? item.mesesReajuste ?? 12 : null,
                      pctReajuste: checked ? item.pctReajuste : null
                    };
                    onChange(next);
                  }}
                />
                <Label
                  htmlFor={`reajuste-${item._key}`}
                  className="cursor-pointer text-xs text-slate-600"
                >
                  Tiene reajuste
                </Label>
              </div>
              {item.mesesReajuste !== null && (
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    disabled={disabled}
                    value={item.mesesReajuste}
                    onChange={(event) => {
                      const val = parseInt(event.target.value, 10);
                      const next = [...ggcc];
                      next[index] = {
                        ...item,
                        mesesReajuste: Number.isNaN(val) || val < 1 ? 1 : val
                      };
                      onChange(next);
                    }}
                    className="h-7 w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-slate-500">meses</span>
                  <Input
                    type="number"
                    step="any"
                    placeholder="% reajuste"
                    disabled={disabled}
                    value={item.pctReajuste ?? ""}
                    onChange={(event) => {
                      const next = [...ggcc];
                      next[index] = {
                        ...item,
                        pctReajuste: event.target.value || null
                      };
                      onChange(next);
                    }}
                    className="h-7 w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-slate-500">% reajuste</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
