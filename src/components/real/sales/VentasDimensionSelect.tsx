"use client";

import { cn } from "@/lib/utils";
import type { SalesDimension } from "@/types/sales-analytics";

export const SALES_DIMENSION_LABELS: Record<SalesDimension, string> = {
  tamano: "Categoría (Tamaño)",
  tipo: "Categoría (Tipo)",
  piso: "Piso",
  zona: "Zona",
  rubro: "Rubro"
};

const ALL_DIMENSIONS: SalesDimension[] = ["tamano", "tipo", "piso", "zona", "rubro"];

type Props = {
  value: SalesDimension;
  onChange: (next: SalesDimension) => void;
  label?: string;
  exclude?: SalesDimension;
  className?: string;
};

export function VentasDimensionSelect({
  value,
  onChange,
  label,
  exclude,
  className
}: Props): JSX.Element {
  const options = ALL_DIMENSIONS.filter((d) => d !== exclude);

  return (
    <label className={cn("flex items-center gap-2 text-xs text-slate-600", className)}>
      {label ? <span className="font-medium">{label}</span> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SalesDimension)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {options.map((d) => (
          <option key={d} value={d}>
            {SALES_DIMENSION_LABELS[d]}
          </option>
        ))}
      </select>
    </label>
  );
}
