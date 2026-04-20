"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ContractFormPayload } from "@/types";

export type TarifaListItem = ContractFormPayload["tarifas"][number] & { _key: string };

type TarifaTipo = TarifaListItem["tipo"];

type TarifaListEditorProps = {
  tarifas: TarifaListItem[];
  onChange: (updated: TarifaListItem[]) => void;
  disabled?: boolean;
  fechasContrato?: { inicio: string; termino: string };
};

export function createEmptyTarifaItem(previous?: TarifaListItem): TarifaListItem {
  const tipo: TarifaTipo = previous?.tipo ?? "FIJO_UF_M2";
  const vigenciaDesde =
    previous && previous.vigenciaHasta ? shiftIsoDate(previous.vigenciaHasta, 1) : "";
  return {
    _key: crypto.randomUUID(),
    tipo,
    valor: "",
    vigenciaDesde,
    vigenciaHasta: null,
    esDiciembre: false,
    descuentoTipo: null,
    descuentoValor: null,
    descuentoDesde: null,
    descuentoHasta: null
  };
}

function shiftIsoDate(iso: string, days: number): string {
  if (!iso) {
    return "";
  }
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}-${month}-${year}`;
}

type CoverageStatus =
  | { kind: "empty" }
  | { kind: "incomplete"; reason: string }
  | { kind: "ok"; from: string; to: string }
  | { kind: "gap"; from: string; to: string }
  | { kind: "overlap" }
  | { kind: "outside"; reason: string };

type CoverageReport = {
  byType: Array<{ tipo: TarifaTipo; status: CoverageStatus; count: number }>;
};

function analyzeCoverage(
  tarifas: TarifaListItem[],
  fechasContrato?: { inicio: string; termino: string }
): CoverageReport {
  const byTipo = new Map<TarifaTipo, TarifaListItem[]>();
  for (const item of tarifas) {
    const list = byTipo.get(item.tipo) ?? [];
    list.push(item);
    byTipo.set(item.tipo, list);
  }

  const hasContrato = Boolean(fechasContrato?.inicio && fechasContrato?.termino);
  const report: CoverageReport["byType"] = [];

  for (const [tipo, items] of byTipo) {
    const hasEmptyDesde = items.some((item) => !item.vigenciaDesde);
    if (hasEmptyDesde) {
      report.push({
        tipo,
        status: { kind: "incomplete", reason: "Falta vigenciaDesde en algún tramo." },
        count: items.length
      });
      continue;
    }

    const sorted = [...items].sort((a, b) => a.vigenciaDesde.localeCompare(b.vigenciaDesde));

    let overlap = false;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current.vigenciaHasta) {
        overlap = true;
        break;
      }
      if (current.vigenciaHasta >= next.vigenciaDesde) {
        overlap = true;
        break;
      }
    }

    if (overlap) {
      report.push({ tipo, status: { kind: "overlap" }, count: items.length });
      continue;
    }

    if (hasContrato && fechasContrato) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (first.vigenciaDesde < fechasContrato.inicio) {
        report.push({
          tipo,
          status: { kind: "outside", reason: "Un tramo empieza antes del contrato." },
          count: items.length
        });
        continue;
      }
      if (last.vigenciaHasta && last.vigenciaHasta > fechasContrato.termino) {
        report.push({
          tipo,
          status: { kind: "outside", reason: "Un tramo termina después del contrato." },
          count: items.length
        });
        continue;
      }
    }

    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current.vigenciaHasta) {
        continue;
      }
      const expected = shiftIsoDate(current.vigenciaHasta, 1);
      if (expected !== next.vigenciaDesde) {
        report.push({
          tipo,
          status: { kind: "gap", from: current.vigenciaHasta, to: next.vigenciaDesde },
          count: items.length
        });
        break;
      }
    }

    if (report.some((r) => r.tipo === tipo)) {
      continue;
    }

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    report.push({
      tipo,
      status: { kind: "ok", from: first.vigenciaDesde, to: last.vigenciaHasta ?? "" },
      count: items.length
    });
  }

  return { byType: report };
}

function CoverageChip({ tipo, status, count }: { tipo: TarifaTipo; status: CoverageStatus; count: number }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border";

  if (status.kind === "ok") {
    return (
      <span className={cn(base, "border-positive-600/30 bg-positive-100 text-positive-700 num")}>
        <span className="h-1.5 w-1.5 rounded-full bg-positive-600" aria-hidden />
        {tipo} · {count} tramo{count === 1 ? "" : "s"} · cubre {formatDisplayDate(status.from)} → {formatDisplayDate(status.to || null)}
      </span>
    );
  }

  if (status.kind === "gap") {
    return (
      <span className={cn(base, "border-negative-600/30 bg-negative-100 text-negative-700")}>
        <span className="h-1.5 w-1.5 rounded-full bg-negative-600" aria-hidden />
        {tipo} · hueco entre {formatDisplayDate(status.from)} y {formatDisplayDate(status.to)}
      </span>
    );
  }

  if (status.kind === "overlap") {
    return (
      <span className={cn(base, "border-negative-600/30 bg-negative-100 text-negative-700")}>
        <span className="h-1.5 w-1.5 rounded-full bg-negative-600" aria-hidden />
        {tipo} · tramos solapados
      </span>
    );
  }

  if (status.kind === "outside") {
    return (
      <span className={cn(base, "border-warning-600/30 bg-warning-100 text-warning-700")}>
        <span className="h-1.5 w-1.5 rounded-full bg-warning-600" aria-hidden />
        {tipo} · {status.reason}
      </span>
    );
  }

  if (status.kind === "incomplete") {
    return (
      <span className={cn(base, "border-surface-200 bg-surface-50 text-slate-600")}>
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
        {tipo} · {status.reason}
      </span>
    );
  }

  return null;
}

export function TarifaListEditor({
  tarifas,
  onChange,
  disabled = false,
  fechasContrato
}: TarifaListEditorProps): JSX.Element {
  const canUseContractDates = Boolean(fechasContrato?.inicio && fechasContrato?.termino);
  const coverage = useMemo(() => analyzeCoverage(tarifas, fechasContrato), [tarifas, fechasContrato]);

  return (
    <div className="rounded-md border border-surface-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h4
            className="font-serif text-title text-brand-700"
            style={{ fontVariationSettings: '"opsz" 20, "wght" 500' }}
          >
            Tarifas fijas
          </h4>
          <p className="text-caption text-slate-500">
            Ej: 0,9 hasta dic 2025 · 1,0 años 1–2 · 1,5 año 3+. Al agregar un tramo, la fecha
            desde se autocompleta con el día siguiente al hasta del tramo anterior.
          </p>
        </div>
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
            onClick={() => {
              const previous = tarifas.length > 0 ? tarifas[tarifas.length - 1] : undefined;
              onChange([...tarifas, createEmptyTarifaItem(previous)]);
            }}
            className="h-auto px-2 py-1 text-sm"
          >
            + Agregar tramo
          </Button>
        </div>
      </div>

      {coverage.byType.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {coverage.byType.map((entry) => (
            <CoverageChip key={entry.tipo} tipo={entry.tipo} status={entry.status} count={entry.count} />
          ))}
        </div>
      ) : null}

      {tarifas.length === 0 ? (
        <p className="font-serif text-sm italic text-slate-500">Sin tarifas configuradas.</p>
      ) : null}

      <div className="space-y-2">
        {tarifas.map((tarifa, index) => (
          <div key={tarifa._key} className="space-y-2 rounded-sm border border-surface-200 bg-surface-50/60 p-3 transition-colors hover:border-brand-300/60">
            <div className="grid gap-2 md:grid-cols-5">
              <Select
                value={tarifa.tipo}
                disabled={disabled}
                onValueChange={(value) => {
                  const next = [...tarifas];
                  next[index] = {
                    ...tarifa,
                    tipo: value as TarifaTipo
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
