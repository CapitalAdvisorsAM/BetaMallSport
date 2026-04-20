"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { TableDisclosureButton } from "@/components/ui/TableDisclosureButton";
import { tableTheme } from "@/components/ui/table-theme";
import { formatUf } from "@/lib/utils";
import type { EeffResponse } from "@/types/finance";

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

function formatUfAccounting(value: number): string {
  if (value === 0) return "—";
  const formatted = formatUf(Math.abs(value));
  return value < 0 ? `(${formatted})` : formatted;
}

function formatPeriodo(period: string): string {
  const [year, month] = period.split("-");
  return month && year ? `${month}/${year.slice(2)}` : period;
}

export function EeffClient({ selectedProjectId, defaultDesde, defaultHasta }: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<EeffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/finance/cash-flow-statement?${params}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      const payload = (await res.json()) as EeffResponse;
      setData(payload);
      setExpandedGroups(new Set(payload.groups.map((group) => group.group)));
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function toggleGroup(group: string): void {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function toggleCategory(group: string, category: string): void {
    const key = `${group}::${category}`;
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="EE.FF. (UF)"
        description="Estado de situación financiera construido desde la hoja Data Balances."
        actions={
          <ProjectPeriodToolbar desde={desde} hasta={hasta} onDesdeChange={setDesde} onHastaChange={setHasta} />
        }
      />

      <ModuleSectionCard>
        {loading ? (
          <ModuleLoadingState message="Cargando EE.FF..." />
        ) : !data || data.groups.length === 0 ? (
          <ModuleEmptyState
            message="Sin datos de balances para el rango seleccionado."
            actionHref="/finance/upload"
            actionLabel="Cargar balances"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={`${tableTheme.table} border-collapse text-[11px]`}>
              <thead className={`${tableTheme.head} sticky top-0 z-20`}>
                <tr className="border-b border-slate-200 bg-brand-700">
                  <th className="sticky left-0 w-80 bg-brand-700 py-2.5 pl-4 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Cuenta
                  </th>
                  {data.periods.map((period) => (
                    <th
                      key={period}
                      className="min-w-[88px] px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70"
                    >
                      {formatPeriodo(period)}
                    </th>
                  ))}
                  <th className="border-l border-white/10 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((group, groupIndex) => {
                  const groupExpanded = expandedGroups.has(group.group);
                  return (
                    <Fragment key={group.group}>
                      {groupIndex > 0 ? (
                        <tr>
                          <td colSpan={data.periods.length + 2} className="h-1 bg-slate-50" />
                        </tr>
                      ) : null}
                      <tr className="border-b border-slate-200 bg-white hover:bg-slate-50">
                        <td className="sticky left-0 bg-white py-2.5 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            <TableDisclosureButton
                              expanded={groupExpanded}
                              label={`${groupExpanded ? "Contraer" : "Expandir"} ${group.group}`}
                              onToggle={() => toggleGroup(group.group)}
                            />
                            <span className="font-bold uppercase tracking-wide text-slate-900">{group.group}</span>
                          </div>
                        </td>
                        {data.periods.map((period) => (
                          <td key={period} className="px-3 py-2.5 text-right font-semibold text-slate-900">
                            {formatUfAccounting(group.byPeriod[period] ?? 0)}
                          </td>
                        ))}
                        <td className="border-l border-slate-200 px-3 py-2.5 text-right font-semibold text-slate-900">
                          {formatUfAccounting(group.total)}
                        </td>
                      </tr>

                      {groupExpanded
                        ? group.categories.map((category) => {
                            const categoryKey = `${group.group}::${category.category}`;
                            const categoryExpanded = expandedCategories.has(categoryKey);
                            return (
                              <Fragment key={categoryKey}>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                  <td className="sticky left-0 bg-slate-50 py-1.5 pl-9 pr-3">
                                    <div className="flex items-center gap-2">
                                      <TableDisclosureButton
                                        expanded={categoryExpanded}
                                        label={`${categoryExpanded ? "Contraer" : "Expandir"} ${category.category}`}
                                        onToggle={() => toggleCategory(group.group, category.category)}
                                        className="h-5 w-5"
                                      />
                                      <span className="font-medium text-slate-600">{category.category}</span>
                                    </div>
                                  </td>
                                  {data.periods.map((period) => (
                                    <td key={period} className="px-3 py-1.5 text-right text-slate-600">
                                      {formatUfAccounting(category.byPeriod[period] ?? 0)}
                                    </td>
                                  ))}
                                  <td className="border-l border-slate-100 px-3 py-1.5 text-right font-medium text-slate-700">
                                    {formatUfAccounting(category.total)}
                                  </td>
                                </tr>
                                {categoryExpanded
                                  ? category.lines.map((line) => (
                                      <tr key={`${categoryKey}::${line.accountCode}`} className="border-b border-slate-50 bg-white">
                                        <td className="sticky left-0 bg-white py-1.5 pl-[72px] pr-3 text-slate-600">
                                          <span className="font-mono text-[10px] text-slate-400">{line.accountCode}</span>
                                          <span className="ml-2">{line.accountName}</span>
                                        </td>
                                        {data.periods.map((period) => (
                                          <td key={period} className="px-3 py-1.5 text-right text-slate-500">
                                            {formatUfAccounting(line.byPeriod[period] ?? 0)}
                                          </td>
                                        ))}
                                        <td className="border-l border-slate-100 px-3 py-1.5 text-right text-slate-600">
                                          {formatUfAccounting(line.total)}
                                        </td>
                                      </tr>
                                    ))
                                  : null}
                              </Fragment>
                            );
                          })
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>
    </main>
  );
}
