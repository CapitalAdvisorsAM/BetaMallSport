"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { cn, formatPeriodoCorto, formatUf } from "@/lib/utils";
import type { BillingCategory } from "@/types/tenant-360";

type DisplayMode = "uf" | "ufm2";

type BillingBreakdownSectionProps = {
  data: BillingCategory[];
  periods: string[];
  totalLeasedM2?: number;
};

function applyDivisor(value: number, mode: DisplayMode, m2: number): number {
  if (mode === "ufm2" && m2 > 0) return value / m2;
  return value;
}

function isCurrentYearPeriod(period: string): boolean {
  const currentYear = new Date().getFullYear().toString();
  return period.startsWith(currentYear);
}

function computeYtd(byPeriod: Record<string, number>, periods: string[]): number {
  return periods.filter(isCurrentYearPeriod).reduce((s, p) => s + (byPeriod[p] ?? 0), 0);
}

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-7 text-right text-[10px] tabular-nums text-slate-400">
        {pct.toFixed(0)}%
      </span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-400 transition-all duration-300"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function BillingBreakdownSection({
  data,
  periods,
  totalLeasedM2 = 0,
}: BillingBreakdownSectionProps): JSX.Element {
  const [mode, setMode] = useState<DisplayMode>("uf");
  const canToggle = totalLeasedM2 > 0;

  const sectionsByGroup1 = useMemo(() => {
    const map = new Map<string, BillingCategory[]>();
    for (const row of data) {
      if (!map.has(row.group1)) map.set(row.group1, []);
      map.get(row.group1)!.push(row);
    }
    return map;
  }, [data]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(data.map((r) => r.group1))
  );

  const grandTotal = useMemo(() => data.reduce((s, r) => s + r.total, 0), [data]);
  const grandYtd = useMemo(
    () => data.reduce((s, r) => s + computeYtd(r.byPeriod, periods), 0),
    [data, periods]
  );

  const totalsByPeriod = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of data) {
      for (const p of periods) {
        map[p] = (map[p] ?? 0) + (row.byPeriod[p] ?? 0);
      }
    }
    return map;
  }, [data, periods]);

  function toggleSection(group1: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(group1)) next.delete(group1);
      else next.add(group1);
      return next;
    });
  }

  const suffix = mode === "ufm2" ? " UF/m²" : "";
  const fmt = (v: number) => (v !== 0 ? `${formatUf(applyDivisor(v, mode, totalLeasedM2))}${suffix}` : "—");

  if (data.length === 0) {
    return (
      <ModuleSectionCard title="Detalle Facturacion">
        <p className="px-4 py-6 text-center text-sm text-slate-400">Sin registros contables para el periodo.</p>
      </ModuleSectionCard>
    );
  }

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
        <table className="min-w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-brand-700">
              <th className="sticky left-0 z-10 w-64 bg-brand-700 py-2 pl-4 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70 border-r border-white/10">
                Partida
              </th>
              {periods.map((p) => (
                <th
                  key={p}
                  className="min-w-[80px] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-white/70 border-r border-white/10"
                >
                  {formatPeriodoCorto(p)}
                </th>
              ))}
              <th className="min-w-[80px] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-amber-300 border-r border-white/10">
                YTD
              </th>
              <th className="min-w-[90px] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-white/70 border-r border-white/10">
                Total
              </th>
              <th className="min-w-[100px] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                % Total
              </th>
            </tr>
          </thead>

          <tbody>
            {[...sectionsByGroup1.entries()].map(([group1, rows], sectionIdx) => {
              const isExpanded = expandedSections.has(group1);
              const sectionTotal = rows.reduce((s, r) => s + r.total, 0);
              const sectionYtd = rows.reduce((s, r) => s + computeYtd(r.byPeriod, periods), 0);
              const sectionPct = grandTotal > 0 ? (sectionTotal / grandTotal) * 100 : 0;

              return (
                <Fragment key={group1}>
                  {sectionIdx > 0 && (
                    <tr>
                      <td colSpan={periods.length + 4} className="h-px bg-slate-200" />
                    </tr>
                  )}

                  {/* Section header row */}
                  <tr
                    className="cursor-pointer bg-slate-50 transition-colors hover:bg-brand-50/50"
                    onClick={() => toggleSection(group1)}
                  >
                    <td className="sticky left-0 z-10 bg-slate-50 py-2.5 pl-3 pr-3 hover:bg-brand-50/50">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
                          {group1}
                        </span>
                      </div>
                    </td>
                    {periods.map((p) => {
                      const v = rows.reduce((s, r) => s + (r.byPeriod[p] ?? 0), 0);
                      return (
                        <td
                          key={p}
                          className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 border-r border-slate-100"
                        >
                          {fmt(v)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-600 border-r border-slate-100">
                      {fmt(sectionYtd)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800 border-r border-slate-100">
                      {fmt(sectionTotal)}
                    </td>
                    <td className="px-3 py-2.5">
                      <ShareBar pct={sectionPct} />
                    </td>
                  </tr>

                  {/* Child rows (group3) */}
                  {isExpanded &&
                    rows.map((row, rowIdx) => {
                      const ytd = computeYtd(row.byPeriod, periods);
                      const rowPct = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0;
                      const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60";

                      return (
                        <tr key={`${group1}::${row.group3}`} className={cn("border-b border-slate-100 transition-colors hover:bg-brand-50/30", rowBg)}>
                          <td className={cn("sticky left-0 z-10 py-1.5 pl-10 pr-3", rowBg)}>
                            <span className="text-slate-600">{row.group3}</span>
                          </td>
                          {periods.map((p) => {
                            const v = row.byPeriod[p] ?? 0;
                            return (
                              <td
                                key={p}
                                className="px-3 py-1.5 text-right tabular-nums text-slate-700 border-r border-slate-100"
                              >
                                {fmt(v)}
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-amber-600 border-r border-slate-100">
                            {fmt(ytd)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-800 border-r border-slate-100">
                            {fmt(row.total)}
                          </td>
                          <td className="px-3 py-1.5">
                            <ShareBar pct={rowPct} />
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}

            {/* Grand total row */}
            <tr className="border-t-2 border-brand-700/20 bg-brand-700 text-white">
              <td className="sticky left-0 z-10 bg-brand-700 py-2.5 pl-4 pr-3">
                <span className="text-[11px] font-bold uppercase tracking-widest">Total</span>
              </td>
              {periods.map((p) => (
                <td key={p} className="px-3 py-2.5 text-right tabular-nums font-bold border-r border-white/15">
                  {fmt(totalsByPeriod[p] ?? 0)}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right tabular-nums font-bold text-amber-300 border-r border-white/15">
                {fmt(grandYtd)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-bold border-r border-white/15">
                {fmt(grandTotal)}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/70">100%</span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full w-full rounded-full bg-white/60" />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ModuleSectionCard>
  );
}
