/**
 * Shared helpers for snapshot-date handling across the Rent Roll module.
 * All pages that accept a `fecha` query param should use these functions
 * instead of re-implementing date parsing locally.
 */
import { startOfDay } from "@/lib/utils";

export function isValidDate(value?: string): value is string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    return false;
  }
  const parsed = parseDateParam(value);
  return formatDateParam(parsed) === value;
}

export function isValidPeriod(value?: string): value is string {
  if (!value) {
    return false;
  }
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function parseDateParam(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Parses a YYYY-MM-DD param into a local Date object, useful for browser-only
 * widgets such as date pickers that should not shift due to timezone offsets.
 */
export function parseDateParamLocal(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateParam(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a local Date object as YYYY-MM-DD without converting through UTC.
 */
export function formatDateParamLocal(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns today's date formatted as YYYY-MM-DD (UTC). */
export function todayParam(): string {
  return formatDateParam(startOfDay(new Date()));
}

/** Resolves the canonical snapshot date from the URL params. */
export function resolveSnapshotDate(fecha?: string, periodo?: string): string {
  if (isValidDate(fecha)) {
    return fecha;
  }
  if (isValidPeriod(periodo)) {
    return `${periodo}-01`;
  }
  return formatDateParam(startOfDay(new Date()));
}

/** Returns the YYYY-MM period string that corresponds to a fecha param. */
export function getPeriodoFromFecha(fecha: string): string {
  return fecha.slice(0, 7);
}

/** Formats a WALT value (months) in human-readable Spanish. */
export function formatWaltValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }
  if (value > 24) {
    return `${formatOneDecimal(value / 12)} anos`;
  }
  return `${formatOneDecimal(value)} meses`;
}

function formatOneDecimal(value: number): string {
  const n = Math.round(value * 10) / 10;
  return n.toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}
