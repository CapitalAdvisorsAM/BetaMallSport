"use client";

import { useMemo } from "react";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { cn } from "@/lib/utils";
import type { OccupancyDayEntry } from "@/types/tenant-360";

type OccupancyTimelineProps = {
  days: OccupancyDayEntry[];
};

type MonthSummary = {
  period: string;
  ocupado: number;
  gracia: number;
  vacante: number;
  total: number;
};

const STATUS_COLORS: Record<string, string> = {
  OCUPADO: "bg-emerald-500",
  GRACIA: "bg-amber-400",
  VACANTE: "bg-rose-400"
};

const STATUS_LABELS: Record<string, string> = {
  OCUPADO: "Ocupado",
  GRACIA: "Gracia",
  VACANTE: "Vacante"
};

export function OccupancyTimeline({ days }: OccupancyTimelineProps): JSX.Element {
  const { units, periods } = useMemo(() => {
    // Group by unit and period
    const unitMap = new Map<string, Map<string, MonthSummary>>();
    const allPeriods = new Set<string>();

    for (const d of days) {
      const period = d.fecha.slice(0, 7);
      allPeriods.add(period);

      const unitPeriods = unitMap.get(d.localCodigo) ?? new Map<string, MonthSummary>();
      const existing = unitPeriods.get(period) ?? { period, ocupado: 0, gracia: 0, vacante: 0, total: 0 };

      if (d.estadoDia === "OCUPADO") existing.ocupado += 1;
      else if (d.estadoDia === "GRACIA") existing.gracia += 1;
      else existing.vacante += 1;
      existing.total += 1;

      unitPeriods.set(period, existing);
      unitMap.set(d.localCodigo, unitPeriods);
    }

    const sortedPeriods = [...allPeriods].sort();
    const sortedUnits = [...unitMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([codigo, periodMap]) => ({ codigo, periodMap }));

    return { units: sortedUnits, periods: sortedPeriods };
  }, [days]);

  if (days.length === 0) {
    return (
      <ModuleSectionCard title="Ocupacion">
        <p className="px-4 py-6 text-center text-sm text-slate-400">Sin datos de ocupacion diaria.</p>
      </ModuleSectionCard>
    );
  }

  return (
    <ModuleSectionCard title="Ocupacion" description="Estado de ocupacion por local y periodo.">
      <div className="px-4 py-3">
        {/* Legend */}
        <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn("h-3 w-3 rounded-sm", STATUS_COLORS[key])} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex flex-col gap-1.5" style={{ minWidth: periods.length * 56 + 80 }}>
            {/* Period headers */}
            <div className="flex items-center gap-0">
              <div className="w-20 shrink-0" />
              {periods.map((p) => (
                <div key={p} className="flex-1 text-center text-[10px] font-medium text-slate-400" style={{ minWidth: 56 }}>
                  {p.slice(5)}
                </div>
              ))}
            </div>

            {/* Unit rows */}
            {units.map(({ codigo, periodMap }) => (
              <div key={codigo} className="flex items-center gap-0">
                <div className="w-20 shrink-0 truncate text-xs font-medium text-slate-600" title={codigo}>
                  {codigo}
                </div>
                {periods.map((p) => {
                  const summary = periodMap.get(p);
                  if (!summary || summary.total === 0) {
                    return (
                      <div key={p} className="flex-1 px-0.5" style={{ minWidth: 56 }}>
                        <div className="h-6 rounded-sm bg-slate-100" />
                      </div>
                    );
                  }

                  const pctOcupado = summary.ocupado / summary.total;
                  const pctGracia = summary.gracia / summary.total;

                  // Determine dominant status for color
                  let dominant: string;
                  if (pctOcupado >= 0.5) dominant = "OCUPADO";
                  else if (pctGracia > 0) dominant = "GRACIA";
                  else dominant = "VACANTE";

                  return (
                    <div
                      key={p}
                      className="flex-1 px-0.5"
                      style={{ minWidth: 56 }}
                      title={`${codigo} ${p}: ${summary.ocupado}d ocupado, ${summary.gracia}d gracia, ${summary.vacante}d vacante`}
                    >
                      <div className={cn("h-6 rounded-sm", STATUS_COLORS[dominant])} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModuleSectionCard>
  );
}
