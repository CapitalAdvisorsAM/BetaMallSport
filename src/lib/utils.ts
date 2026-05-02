import { ContractStatus } from "@prisma/client";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { MS_PER_DAY, UF_STALENESS_DAYS } from "@/lib/constants";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(value: Date | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

export function formatDecimal(value: number | string): string {
  return Number(value).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatUf(value: number, fractionDigits = 2): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

export function formatUfPerM2(value: number): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  });
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })}%`;
}

export function formatSquareMeters(value: number): string {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} m\u00b2`;
}

export function formatClp(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDateString(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfDay(date: Date): Date {
  const output = new Date(date);
  output.setHours(0, 0, 0, 0);
  return output;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function ufAgeInDays(fecha: Date | null, today: Date = startOfDay(new Date())): number | null {
  if (!fecha) {
    return null;
  }
  return Math.floor((today.getTime() - startOfDay(fecha).getTime()) / MS_PER_DAY);
}

export function isUfStale(fecha: Date | null, today: Date = startOfDay(new Date())): boolean {
  const age = ufAgeInDays(fecha, today);
  if (age === null) {
    return true;
  }
  return age > UF_STALENESS_DAYS;
}

export function computeEstadoContrato(
  fechaInicio: Date,
  fechaTermino: Date,
  diasGracia: number,
  estadoManual: ContractStatus,
  today: Date
): ContractStatus {
  if (estadoManual === ContractStatus.TERMINADO_ANTICIPADO) {
    return ContractStatus.TERMINADO_ANTICIPADO;
  }
  if (today > fechaTermino) {
    return ContractStatus.TERMINADO;
  }
  if (today < startOfDay(fechaInicio)) {
    return ContractStatus.NO_INICIADO;
  }
  const finGracia = addDays(fechaInicio, diasGracia);
  if (today < finGracia) {
    return ContractStatus.GRACIA;
  }
  return ContractStatus.VIGENTE;
}

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function formatPeriodo(periodo: string): string {
  const [year, month] = periodo.split("-");
  if (!year || !month) return periodo;
  return `${MESES_ES[parseInt(month, 10) - 1] ?? month} ${year}`;
}

export function formatPeriodoCorto(periodo: string): string {
  const [year, month] = periodo.split("-");
  if (!year || !month) return periodo;
  return `${MESES_ES[parseInt(month, 10) - 1] ?? month} ${year.slice(-2)}`;
}

export function groupPeriodosByYear(periods: string[]): { year: string; count: number }[] {
  const groups: { year: string; count: number }[] = [];
  for (const p of periods) {
    const y = p.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last?.year === y) last.count++;
    else groups.push({ year: y, count: 1 });
  }
  return groups;
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function slugify(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "proyecto";
}
