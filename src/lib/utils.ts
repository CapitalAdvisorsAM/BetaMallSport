import { ContractStatus } from "@prisma/client";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function slugify(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "proyecto";
}
