"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ReportDateSelectorProps = {
  projectId: string;
  initialReportDate: string | null;
  canEdit: boolean;
};

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

const MONTH_NAMES_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function parseValue(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function toValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (
    value !== null &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  ) {
    return (value as { message: string }).message;
  }
  return fallback;
}

export function ReportDateSelector({
  projectId,
  initialReportDate,
  canEdit
}: ReportDateSelectorProps): JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState<string>(initialReportDate ?? "");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const parsed = useMemo(() => parseValue(value), [value]);
  const nowYear = new Date().getFullYear();
  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? nowYear);

  async function handleSelect(next: string): Promise<void> {
    setValue(next);
    setOpen(false);
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportDate: next || null })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(readErrorMessage(body, "Error al actualizar fecha."));
      }
      toast.success("Fecha de reporte actualizada.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar fecha.");
      setValue(initialReportDate ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => canEdit && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!canEdit || saving}
          className={cn(
            "inline-flex items-center gap-2 rounded-sm border border-surface-200 bg-white px-3 py-1.5",
            "text-left shadow-card transition-colors",
            canEdit ? "hover:border-brand-300 hover:bg-brand-50/40" : "opacity-70",
            "disabled:opacity-60"
          )}
        >
          <span className="overline text-slate-400">Reporte</span>
          <span className="font-serif text-sm text-brand-700" style={{ fontVariationSettings: '"opsz" 20, "wght" 500' }}>
            {parsed ? MONTH_NAMES_LONG[parsed.month - 1] : "—"}
          </span>
          <span className="font-mono text-xs text-slate-500 num">
            {parsed ? parsed.year : ""}
          </span>
          {saving ? (
            <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500/60" aria-hidden />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            className="rounded-sm px-2 py-1 text-xs text-slate-600 hover:bg-surface-100"
            aria-label="Año anterior"
          >
            ‹
          </button>
          <span className="font-serif text-sm text-brand-700" style={{ fontVariationSettings: '"opsz" 20, "wght" 500' }}>
            {viewYear}
          </span>
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            className="rounded-sm px-2 py-1 text-xs text-slate-600 hover:bg-surface-100"
            aria-label="Año siguiente"
          >
            ›
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {MONTH_NAMES.map((name, i) => {
            const monthNum = i + 1;
            const candidate = toValue(viewYear, monthNum);
            const isSelected = candidate === value;
            return (
              <button
                type="button"
                key={name}
                onClick={() => void handleSelect(candidate)}
                className={cn(
                  "rounded-sm px-2 py-1.5 text-sm transition-colors",
                  isSelected
                    ? "bg-brand-500 text-white font-semibold"
                    : "text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
        {value ? (
          <div className="mt-3 flex justify-end border-t border-surface-200 pt-2">
            <button
              type="button"
              onClick={() => void handleSelect("")}
              className="text-[11px] text-slate-500 hover:text-negative-700"
            >
              Limpiar
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export default ReportDateSelector;
