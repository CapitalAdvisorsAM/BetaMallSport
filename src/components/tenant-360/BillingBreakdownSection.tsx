"use client";

import { useMemo, useState } from "react";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { tableTheme } from "@/components/ui/table-theme";
import { formatUf, cn } from "@/lib/utils";
import type { BillingCategory } from "@/types/tenant-360";

type DisplayMode = "uf" | "ufm2";

type BillingBreakdownSectionProps = {
  data: BillingCategory[];
  periods: string[];
  totalLeasedM2?: number;
};

function heatColor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return "";
  const intensity = Math.min(value / max, 1);
  if (intensity > 0.7) return "bg-brand-100";
  if (intensity > 0.3) return "bg-brand-50";
  return "";
}

function applyDivisor(value: number, mode: DisplayMode, m2: number): number {
  if (mode === "ufm2" && m2 > 0) return value / m2;
  return value;
}

export function BillingBreakdownSection({ data, periods, totalLeasedM2 = 0 }: BillingBreakdownSectionProps): JSX.Element {
  const [mode, setMode] = useState<DisplayMode>("uf");
  const canToggle = totalLeasedM2 > 0;

  const maxValue = useMemo(() => {
    let max = 0;
    for (const row of data) {
      for (const v of Object.values(row.byPeriod)) {
        const adjusted = applyDivisor(v, mode, totalLeasedM2);
        if (adjusted > max) max = adjusted;
      }
    }
    return max;
  }, [data, mode, totalLeasedM2]);

  if (data.length === 0) {
    return (
      <ModuleSectionCard title="Detalle Facturacion">
        <p className="px-4 py-6 text-center text-sm text-slate-400">Sin registros contables para el periodo.</p>
      </ModuleSectionCard>
    );
  }

  const suffix = mode === "ufm2" ? " UF/m\u00b2" : "";

  return (
    <ModuleSectionCard
      title="Detalle Facturacion"
      description="Registros contables agrupados por categoria y periodo."
      headerAction={
        canToggle ? (
          <div className="inline-flex rounded-md border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setMode("uf")}
              className={cn(
                "px-3 py-1 rounded-l-md transition-colors",
                mode === "uf" ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              UF
            </button>
            <button
              type="button"
              onClick={() => setMode("ufm2")}
              className={cn(
                "px-3 py-1 rounded-r-md transition-colors",
                mode === "ufm2" ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              UF/m²
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className={tableTheme.table}>
          <thead className={tableTheme.head}>
            <tr>
              <th className={`${tableTheme.compactHeadCell} sticky left-0 bg-brand-700`}>Grupo</th>
              <th className={tableTheme.compactHeadCell}>Partida</th>
              {periods.map((p) => (
                <th key={p} className={`${tableTheme.compactHeadCell} text-right`}>{p}</th>
              ))}
              <th className={`${tableTheme.compactHeadCell} text-right`}>YTD</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, i) => {
              const ytd = computeYtd(row.byPeriod, periods);
              return (
                <tr key={i} className={tableTheme.rowHover}>
                  <td className="sticky left-0 bg-white px-3 py-1.5 text-xs text-slate-500">{row.group1}</td>
                  <td className="px-3 py-1.5 text-xs font-medium text-slate-600">{row.group3}</td>
                  {periods.map((p) => {
                    const raw = row.byPeriod[p] ?? 0;
                    const v = applyDivisor(raw, mode, totalLeasedM2);
                    return (
                      <td
                        key={p}
                        className={cn(
                          "px-3 py-1.5 text-right text-xs tabular-nums text-slate-700",
                          heatColor(v, maxValue)
                        )}
                      >
                        {v !== 0 ? `${formatUf(v)}${suffix}` : "\u2014"}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-brand-600">
                    {ytd !== 0 ? `${formatUf(applyDivisor(ytd, mode, totalLeasedM2))}${suffix}` : "\u2014"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-800">
                    {formatUf(applyDivisor(row.total, mode, totalLeasedM2))}{suffix}
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 border-brand-700/20 bg-slate-50 font-semibold">
              <td className="sticky left-0 bg-slate-50 px-3 py-2 text-xs text-brand-700" colSpan={2}>
                Total
              </td>
              {periods.map((p) => {
                const total = data.reduce((s, row) => s + (row.byPeriod[p] ?? 0), 0);
                const v = applyDivisor(total, mode, totalLeasedM2);
                return (
                  <td key={p} className="px-3 py-2 text-right text-xs tabular-nums text-brand-700">
                    {v !== 0 ? `${formatUf(v)}${suffix}` : "\u2014"}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right text-xs tabular-nums text-brand-700">
                {(() => {
                  const ytdTotal = periods
                    .filter(isCurrentYearPeriod)
                    .reduce((s, p) => s + data.reduce((rs, row) => rs + (row.byPeriod[p] ?? 0), 0), 0);
                  return ytdTotal !== 0 ? `${formatUf(applyDivisor(ytdTotal, mode, totalLeasedM2))}${suffix}` : "\u2014";
                })()}
              </td>
              <td className="px-3 py-2 text-right text-xs tabular-nums text-brand-700">
                {formatUf(applyDivisor(data.reduce((s, row) => s + row.total, 0), mode, totalLeasedM2))}{suffix}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ModuleSectionCard>
  );
}

function isCurrentYearPeriod(period: string): boolean {
  const currentYear = new Date().getFullYear().toString();
  return period.startsWith(currentYear);
}

function computeYtd(byPeriod: Record<string, number>, periods: string[]): number {
  return periods.filter(isCurrentYearPeriod).reduce((s, p) => s + (byPeriod[p] ?? 0), 0);
}
