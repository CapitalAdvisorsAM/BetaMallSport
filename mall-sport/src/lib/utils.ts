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
