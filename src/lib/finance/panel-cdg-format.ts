import { formatPercent, formatSquareMeters, formatUf, formatUfPerM2 } from "@/lib/utils";
import type { PanelCdgUnit } from "@/types/panel-cdg";

const DASH = "\u2014";

export function formatPanelValue(value: number | null, unit: PanelCdgUnit): string {
  if (value === null || Number.isNaN(value)) return DASH;
  if (unit === "uf") return formatUf(value);
  if (unit === "m2") return formatSquareMeters(value);
  if (unit === "pct") return formatPercent(value);
  return `${formatUfPerM2(value)} UF/m\u00b2`;
}

export function formatPanelYoy(value: number | null): string {
  if (value === null || Number.isNaN(value)) return DASH;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export type Semaphore = "green" | "amber" | "red" | "neutral";

export function realVsPptoSemaphore(real: number | null, ppto: number | null): Semaphore {
  if (real === null || ppto === null || ppto === 0) return "neutral";
  const ratio = real / ppto;
  if (ratio >= 1) return "green";
  if (ratio >= 0.95) return "amber";
  return "red";
}

export function yoySemaphore(yoy: number | null): Semaphore {
  if (yoy === null) return "neutral";
  if (yoy > 0) return "green";
  if (yoy < 0) return "red";
  return "neutral";
}

const SEMAPHORE_CLASS: Record<Semaphore, string> = {
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-rose-700",
  neutral: "text-slate-700"
};

export function semaphoreClass(semaphore: Semaphore): string {
  return SEMAPHORE_CLASS[semaphore];
}
