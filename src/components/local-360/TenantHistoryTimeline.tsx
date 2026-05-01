"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { chartColors } from "@/lib/charts/theme";
import { cn, formatDateString, formatUf } from "@/lib/utils";
import type { TenantHistoryEntry } from "@/types/local-360";

type TenantHistoryTimelineProps = {
  history: TenantHistoryEntry[];
  selectedProjectId: string;
};

function statusColor(estado: string, isCurrent: boolean): string {
  if (isCurrent) return chartColors.brandPrimary;
  if (estado === "VIGENTE" || estado === "GRACIA") return chartColors.brandLight;
  if (estado === "TERMINADO_ANTICIPADO") return "#dc2626";
  return "#94a3b8";
}

export function TenantHistoryTimeline({
  history,
  selectedProjectId,
}: TenantHistoryTimelineProps): JSX.Element {
  const { rows, minDate, maxDate, totalMs, gaps } = useMemo(() => {
    if (history.length === 0) {
      return { rows: [], minDate: 0, maxDate: 0, totalMs: 1, gaps: [] as { startMs: number; endMs: number }[] };
    }
    const starts = history.map((h) => new Date(h.fechaInicio).getTime());
    const ends = history.map((h) => new Date(h.fechaTermino).getTime());
    const minDate = Math.min(...starts);
    const maxDate = Math.max(...ends);
    const totalMs = Math.max(1, maxDate - minDate);

    const sortedByStart = [...history].sort(
      (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime(),
    );

    const gaps: { startMs: number; endMs: number }[] = [];
    for (let i = 0; i < sortedByStart.length - 1; i++) {
      const endA = new Date(sortedByStart[i].fechaTermino).getTime();
      const startB = new Date(sortedByStart[i + 1].fechaInicio).getTime();
      if (startB > endA + 86_400_000) {
        gaps.push({ startMs: endA, endMs: startB });
      }
    }

    return { rows: sortedByStart, minDate, maxDate, totalMs, gaps };
  }, [history]);

  if (history.length === 0) {
    return (
      <ModuleSectionCard title="Historia de Arrendatarios">
        <p className="px-4 py-6 text-center text-sm text-slate-400">
          Este local no tiene contratos registrados.
        </p>
      </ModuleSectionCard>
    );
  }

  return (
    <ModuleSectionCard
      title="Historia de Arrendatarios"
      description={`${history.length} contrato(s) — desde ${formatDateString(rows[0]?.fechaInicio ?? null)} a ${formatDateString(rows[rows.length - 1]?.fechaTermino ?? null)}`}
    >
      <div className="px-5 py-4">
        <div className="space-y-2">
          {/* Year axis */}
          <YearAxis minMs={minDate} maxMs={maxDate} />

          {/* Gaps row (vacancies) */}
          {gaps.length > 0 ? (
            <div className="relative h-6 rounded-md bg-slate-50">
              {gaps.map((g, idx) => (
                <div
                  key={`gap-${idx}`}
                  title={`Vacancia: ${formatDateString(new Date(g.startMs).toISOString().slice(0, 10))} → ${formatDateString(new Date(g.endMs).toISOString().slice(0, 10))}`}
                  className="absolute top-0 h-full bg-rose-200"
                  style={{
                    left: `${((g.startMs - minDate) / totalMs) * 100}%`,
                    width: `${((g.endMs - g.startMs) / totalMs) * 100}%`,
                  }}
                />
              ))}
              <span className="absolute right-2 top-1 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                Vacancia
              </span>
            </div>
          ) : null}

          {/* Tenant bars */}
          {rows.map((entry) => {
            const startMs = new Date(entry.fechaInicio).getTime();
            const endMs = new Date(entry.fechaTermino).getTime();
            const left = ((startMs - minDate) / totalMs) * 100;
            const width = ((endMs - startMs) / totalMs) * 100;
            const color = statusColor(entry.estado, entry.isCurrent);
            return (
              <div key={entry.contractId} className="relative h-9 rounded-md bg-slate-50">
                <Link
                  href={`/tenants/${entry.tenantId}?proyecto=${selectedProjectId}`}
                  className={cn(
                    "absolute top-0 flex h-full items-center justify-start overflow-hidden rounded-md px-2 text-xs font-medium text-white transition-opacity hover:opacity-80",
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(2, width)}%`,
                    backgroundColor: color,
                  }}
                  title={`${entry.tenantName} (${entry.tenantRut}) · ${formatDateString(entry.fechaInicio)} → ${formatDateString(entry.fechaTermino)} · ${entry.monthlyRentUf !== null ? formatUf(entry.monthlyRentUf) + " UF/mes" : "Sin tarifa fija"}`}
                >
                  <span className="truncate">
                    {entry.tenantName}
                    {entry.isCurrent ? " · Actual" : ""}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <LegendChip color={chartColors.brandPrimary} label="Vigente" />
          <LegendChip color={chartColors.brandLight} label="Pasado / Terminado" />
          <LegendChip color="#dc2626" label="Terminado anticipado" />
          <LegendChip color="#fecaca" label="Vacancia" />
        </div>
      </div>
    </ModuleSectionCard>
  );
}

function YearAxis({ minMs, maxMs }: { minMs: number; maxMs: number }): JSX.Element {
  const startYear = new Date(minMs).getUTCFullYear();
  const endYear = new Date(maxMs).getUTCFullYear();
  const totalMs = Math.max(1, maxMs - minMs);
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  return (
    <div className="relative h-5 border-b border-slate-200">
      {years.map((year) => {
        const ms = Date.UTC(year, 0, 1);
        const left = ((ms - minMs) / totalMs) * 100;
        if (left < 0 || left > 100) return null;
        return (
          <span
            key={year}
            className="absolute -top-0.5 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            style={{ left: `${left}%` }}
          >
            {year}
          </span>
        );
      })}
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}
