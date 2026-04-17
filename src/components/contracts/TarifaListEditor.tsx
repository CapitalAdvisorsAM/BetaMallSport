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
  fechasContrato?: { inicio: string; termino: string };
};

export function createEmptyTarifaItem(): TarifaListItem {
  return {
    _key: crypto.randomUUID(),
    tipo: "FIJO_UF_M2",
    valor: "",
    vigenciaDesde: "",
    vigenciaHasta: null,
    esDiciembre: false,
    descuentoTipo: null,
    descuentoValor: null,
    descuentoDesde: null,
    descuentoHasta: null
  };
}

export function TarifaListEditor({
  tarifas,
  onChange,
  disabled = false,
  fechasContrato
}: TarifaListEditorProps): JSX.Element {
  const canUseContractDates = Boolean(fechasContrato?.inicio && fechasContrato?.termino);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">Tarifas fijas</h4>
        <div className="flex items-center gap-2">
          {canUseContractDates ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || tarifas.length === 0}
              onClick={() => {
                if (!fechasContrato) {
                  return;
                }

                const next = tarifas.map((item) => ({
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
            onClick={() => onChange([...tarifas, createEmptyTarifaItem()])}
            className="h-auto px-2 py-1 text-sm"
          >
            + Agregar
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {tarifas.map((tarifa, index) => (
          <div key={tarifa._key} className="space-y-2 rounded-md border border-slate-100 bg-slate-50 p-2">
            <div className="grid gap-2 md:grid-cols-5">
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
            <div className="grid gap-2 md:grid-cols-4">
              <Select
                value={tarifa.descuentoTipo ?? "NONE"}
                disabled={disabled}
                onValueChange={(value) => {
                  const next = [...tarifas];
                  if (value === "NONE") {
                    next[index] = {
                      ...tarifa,
                      descuentoTipo: null,
                      descuentoValor: null,
                      descuentoDesde: null,
                      descuentoHasta: null
                    };
                  } else {
                    next[index] = {
                      ...tarifa,
                      descuentoTipo: value as "PORCENTAJE" | "MONTO_UF"
                    };
                  }
                  onChange(next);
                }}
              >
                <SelectTrigger className="rounded-md px-2 py-2 text-sm">
                  <SelectValue placeholder="Sin descuento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin descuento</SelectItem>
                  <SelectItem value="PORCENTAJE">Descuento %</SelectItem>
                  <SelectItem value="MONTO_UF">Descuento UF</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder={tarifa.descuentoTipo === "PORCENTAJE" ? "0.10 = 10%" : "Monto UF"}
                disabled={disabled || tarifa.descuentoTipo === null}
                value={tarifa.descuentoValor ?? ""}
                onChange={(event) => {
                  const next = [...tarifas];
                  next[index] = { ...tarifa, descuentoValor: event.target.value.trim() ? event.target.value : null };
                  onChange(next);
                }}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <Input
                type="date"
                placeholder="Desde"
                disabled={disabled || tarifa.descuentoTipo === null}
                value={tarifa.descuentoDesde ?? ""}
                onChange={(event) => {
                  const next = [...tarifas];
                  next[index] = { ...tarifa, descuentoDesde: event.target.value || null };
                  onChange(next);
                }}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
              <Input
                type="date"
                placeholder="Hasta"
                disabled={disabled || tarifa.descuentoTipo === null}
                value={tarifa.descuentoHasta ?? ""}
                onChange={(event) => {
                  const next = [...tarifas];
                  next[index] = { ...tarifa, descuentoHasta: event.target.value || null };
                  onChange(next);
                }}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
