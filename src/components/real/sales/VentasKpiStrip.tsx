"use client";

import { DeltaPill } from "@/components/ui/DeltaPill";
import { cn, formatUf, formatUfPerM2 } from "@/lib/utils";
import type { VentasKpisResponse } from "@/types/sales-analytics";

type Props = {
  data: VentasKpisResponse | null;
  loading: boolean;
  className?: string;
};

type Cell = {
  label: string;
  value: string;
  hint?: React.ReactNode;
};

function formatInt(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}

export function VentasKpiStrip({ data, loading, className }: Props): JSX.Element {
  const cells: Cell[] = data
    ? [
        {
          label: "Ventas UF (período)",
          value: formatUf(data.ventasUfTotal, 0),
          hint: <DeltaPill value={data.yoyPct} kind="ingreso" mode="variance" />
        },
        {
          label: "UF/m² del período",
          value: formatUfPerM2(data.ufPerM2Period)
        },
        {
          label: "YoY %",
          value:
            data.yoyPct === null
              ? "—"
              : `${data.yoyPct >= 0 ? "+" : ""}${data.yoyPct.toFixed(1)}%`
        },
        {
          label: "Locales con ventas",
          value: formatInt(data.localesConVentas)
        },
        {
          label: "Ticket UF/m² (prom. mes)",
          value: formatUfPerM2(data.ufPerM2MensualPromedio)
        }
      ]
    : [];

  if (loading && !data) {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-3 rounded-md border border-surface-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-5",
          className
        )}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!data) return <div className="hidden" aria-hidden="true" />;

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 rounded-md border border-surface-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-5",
        className
      )}
    >
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">
            {cell.label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-xl text-brand-700" style={{ fontVariationSettings: '"wght" 500' }}>
              {cell.value}
            </span>
            {cell.hint ? <span className="shrink-0">{cell.hint}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
