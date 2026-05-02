"use client";

import { Fragment, useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { TableDisclosureButton } from "@/components/ui/TableDisclosureButton";
import { formatEerr } from "@/lib/real/eerr";
import { cn, formatPercent, groupPeriodosByYear } from "@/lib/utils";
import type {
  ExpenseDetailResponse,
  ExpenseDetailRow,
  ExpensePivotResponse,
  ExpensePivotRow
} from "@/types/expenses";

type ExpensesClientProps = {
  selectedProjectId: string;
  defaultDesde: string;
  defaultHasta: string;
  initialData: ExpensePivotResponse;
};

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatPeriodo(p: string): string {
  const [year, month] = p.split("-");
  if (!year || !month) return p;
  return `${MESES_ES[parseInt(month, 10) - 1] ?? month} ${year.slice(2)}`;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return fallback;
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

const HEAD_CLS =
  "min-w-[90px] px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70 border-r border-white/10";
const GR = "border-r border-slate-100";

export function ExpensesClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta,
  initialData
}: ExpensesClientProps): JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(defaultHasta);
  const [showYoy, setShowYoy] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [detailCache, setDetailCache] = useState<Map<string, ExpenseDetailRow[]>>(new Map());
  const [loadingRows, setLoadingRows] = useState<Set<string>>(new Set());

  const data = initialData;
  const yearGroups = useMemo(() => groupPeriodosByYear(data.periods), [data.periods]);
  const colCount = 1 + data.periods.length + 1 + (showYoy ? 1 : 0);

  const sectionsByGroup1 = useMemo(() => {
    const map = new Map<string, ExpensePivotRow[]>();
    for (const row of data.rows) {
      if (!map.has(row.group1)) map.set(row.group1, []);
      map.get(row.group1)!.push(row);
    }
    return map;
  }, [data.rows]);

  const updateRange = useCallback(
    (nextDesde: string, nextHasta: string) => {
      setDesde(nextDesde);
      setHasta(nextHasta);
      const params = new URLSearchParams();
      if (nextDesde) params.set("from", nextDesde);
      if (nextHasta) params.set("to", nextHasta);
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `/real/expenses?${query}` : "/real/expenses");
      });
    },
    [router]
  );

  const toggleRow = useCallback(
    async (group1: string, group3: string) => {
      const key = `${group1}::${group3}`;
      setExpandedRows((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      if (detailCache.has(key)) return;
      setLoadingRows((prev) => new Set(prev).add(key));
      try {
        const params = new URLSearchParams({
          projectId: selectedProjectId,
          grupo1: group1,
          grupo3: group3
        });
        if (desde) params.set("from", desde);
        if (hasta) params.set("to", hasta);
        const response = await fetch(`/api/real/expenses/detail?${params}`);
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Error al cargar el detalle."));
        }
        const payload = (await response.json()) as ExpenseDetailResponse;
        setDetailCache((prev) => new Map(prev).set(key, payload.rows));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado.");
      } finally {
        setLoadingRows((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [detailCache, desde, hasta, selectedProjectId]
  );

  const sectionTotals = useMemo(() => {
    const totals = new Map<string, { byPeriod: Record<string, number>; total: number; totalPriorYear: number }>();
    for (const [group1, rows] of sectionsByGroup1.entries()) {
      const byPeriod: Record<string, number> = {};
      let total = 0;
      let totalPriorYear = 0;
      for (const row of rows) {
        for (const period of data.periods) {
          const v = row.byPeriod[period] ?? 0;
          byPeriod[period] = (byPeriod[period] ?? 0) + v;
        }
        total += row.total;
        totalPriorYear += row.totalPriorYear ?? 0;
      }
      totals.set(group1, { byPeriod, total, totalPriorYear });
    }
    return totals;
  }, [sectionsByGroup1, data.periods]);

  const yoyVariance = (current: number, prior: number | null): number | null => {
    if (prior == null || prior === 0) return null;
    return ((current - prior) / Math.abs(prior)) * 100;
  };

  const isEmpty = data.rows.length === 0;

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Detalle de Gastos Operativos (UF)"
        description="Detalle interactivo de gastos del mall por categoría y periodo, con drill-down a transacciones."
        valueBadges={["efectivo"]}
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showYoy}
                onChange={(event) => setShowYoy(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
              />
              Comparar año anterior
            </label>
            <ProjectPeriodToolbar
              desde={desde}
              hasta={hasta}
              onDesdeChange={(value) => updateRange(value, hasta)}
              onHastaChange={(value) => updateRange(desde, value)}
            />
          </div>
        }
      />

      <ModuleSectionCard>
        {isEmpty ? (
          <ModuleEmptyState
            message="Sin gastos operativos para el periodo seleccionado."
            actionHref="/imports"
            actionLabel="Cargar datos contables"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse font-sans text-[11px]">
              <thead>
                {yearGroups.length > 1 && (
                  <tr className="bg-brand-700">
                    <th className="sticky left-0 z-10 w-72 bg-brand-700 py-0.5 border-r border-white/10" />
                    {yearGroups.map(({ year, count }, idx) => (
                      <th
                        key={year}
                        colSpan={count}
                        className={cn(
                          "py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-white/30",
                          idx > 0 && "border-l border-white/15"
                        )}
                      >
                        {year}
                      </th>
                    ))}
                    <th className="py-0.5 border-l border-white/15" />
                    {showYoy && <th className="py-0.5" />}
                  </tr>
                )}
                <tr className="border-b border-slate-200 bg-brand-700">
                  <th className="sticky left-0 z-10 w-72 bg-brand-700 py-2.5 pl-4 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70 border-r border-white/10">
                    En UF
                  </th>
                  {data.periods.map((p) => (
                    <th key={p} className={HEAD_CLS}>
                      {formatPeriodo(p)}
                    </th>
                  ))}
                  <th className={HEAD_CLS}>Total</th>
                  {showYoy && <th className={cn(HEAD_CLS, "text-amber-300")}>YoY %</th>}
                </tr>
              </thead>

              <tbody>
                {[...sectionsByGroup1.entries()].map(([group1, rows], sectionIdx) => {
                  const totals = sectionTotals.get(group1)!;
                  const sectionYoy = yoyVariance(totals.total, totals.totalPriorYear);
                  return (
                    <Fragment key={group1}>
                      {sectionIdx > 0 && (
                        <tr>
                          <td colSpan={colCount} className="h-1 bg-slate-50" />
                        </tr>
                      )}

                      <tr className="border-b border-slate-200 bg-white">
                        <td className="sticky left-0 z-10 bg-white py-2.5 pl-4 pr-3">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-900">
                            {group1}
                          </span>
                        </td>
                        {data.periods.map((p) => (
                          <td
                            key={p}
                            className={cn("px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900", GR)}
                          >
                            {formatEerr(totals.byPeriod[p] ?? 0)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold border-l border-slate-200 text-slate-900">
                          {formatEerr(totals.total)}
                        </td>
                        {showYoy && (
                          <td
                            className={cn(
                              "px-3 py-2.5 text-right tabular-nums font-semibold",
                              sectionYoy == null
                                ? "text-slate-400"
                                : sectionYoy > 0
                                  ? "text-rose-600"
                                  : "text-emerald-700"
                            )}
                          >
                            {sectionYoy != null ? formatPercent(sectionYoy) : "—"}
                          </td>
                        )}
                      </tr>

                      {rows.map((row, rowIdx) => {
                        const key = `${row.group1}::${row.group3}`;
                        const isExpanded = expandedRows.has(key);
                        const isLoading = loadingRows.has(key);
                        const detailRows = detailCache.get(key);
                        const lineYoy = yoyVariance(row.total, row.totalPriorYear);
                        const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50";

                        return (
                          <Fragment key={key}>
                            <tr className={cn("border-b border-slate-100 transition-colors hover:bg-slate-100/60", rowBg)}>
                              <td className={cn("sticky left-0 z-10 py-1.5 pl-9 pr-3", rowBg)}>
                                <div className="flex items-center gap-2">
                                  <TableDisclosureButton
                                    expanded={isExpanded}
                                    loading={isLoading}
                                    label={`${isExpanded ? "Contraer" : "Expandir"} ${row.group3}`}
                                    onToggle={() => {
                                      void toggleRow(row.group1, row.group3);
                                    }}
                                    className="h-5 w-5"
                                  />
                                  <span className="text-slate-700">{row.group3}</span>
                                </div>
                              </td>
                              {data.periods.map((p) => (
                                <td
                                  key={p}
                                  className={cn("px-3 py-1.5 text-right tabular-nums text-slate-700", GR)}
                                >
                                  {formatEerr(row.byPeriod[p] ?? 0)}
                                </td>
                              ))}
                              <td className="px-3 py-1.5 text-right tabular-nums font-medium border-l border-slate-100 text-slate-800">
                                {formatEerr(row.total)}
                              </td>
                              {showYoy && (
                                <td
                                  className={cn(
                                    "px-3 py-1.5 text-right tabular-nums",
                                    lineYoy == null
                                      ? "text-slate-400"
                                      : lineYoy > 0
                                        ? "text-rose-600"
                                        : "text-emerald-700"
                                  )}
                                >
                                  {lineYoy != null ? formatPercent(lineYoy) : "—"}
                                </td>
                              )}
                            </tr>

                            {isExpanded && detailRows && detailRows.length > 0 && (
                              <tr className="border-b border-slate-100 bg-slate-50">
                                <td colSpan={colCount} className="px-4 py-3">
                                  <table className="min-w-full text-[11px]">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-2 py-1.5">Fecha</th>
                                        <th className="px-2 py-1.5">Denominación</th>
                                        <th className="px-2 py-1.5">CC</th>
                                        <th className="px-2 py-1.5">Local</th>
                                        <th className="px-2 py-1.5">Arrendatario</th>
                                        <th className="px-2 py-1.5 text-right">Valor UF</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detailRows.map((detail) => (
                                        <tr key={detail.id} className="border-b border-slate-100 last:border-0">
                                          <td className="px-2 py-1 font-mono text-[10px] text-slate-500">{detail.period}</td>
                                          <td className="px-2 py-1 text-slate-700">{detail.denomination}</td>
                                          <td className="px-2 py-1 font-mono text-[10px] text-slate-500">
                                            {detail.costCenterCode ?? "—"}
                                          </td>
                                          <td className="px-2 py-1 text-slate-600">
                                            {detail.unit ? (
                                              <>
                                                <span className="font-mono text-[10px] text-slate-400">[{detail.unit.code}]</span>{" "}
                                                {detail.unit.name}
                                              </>
                                            ) : (
                                              "—"
                                            )}
                                          </td>
                                          <td className="px-2 py-1 text-slate-600">{detail.tenant?.tradeName ?? "—"}</td>
                                          <td className="px-2 py-1 text-right tabular-nums font-medium text-slate-800">
                                            {formatEerr(detail.valueUf, 2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}

                            {isExpanded && detailRows && detailRows.length === 0 && (
                              <tr className="border-b border-slate-100 bg-slate-50">
                                <td colSpan={colCount} className="px-4 py-3 text-center text-[11px] text-slate-400">
                                  Sin transacciones para esta categoría en el rango.
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}

                <tr className="border-t-[3px] border-b-[3px] border-slate-800 bg-white">
                  <td className="sticky left-0 z-10 bg-white py-3 pl-4 pr-3">
                    <span className="text-[12px] font-bold uppercase tracking-widest text-slate-900">Total Gastos</span>
                  </td>
                  {data.periods.map((p) => (
                    <td
                      key={p}
                      className={cn("px-3 py-3 text-right text-[12px] font-bold tabular-nums text-slate-900", GR)}
                    >
                      {formatEerr(data.totalsByPeriod[p] ?? 0)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right text-[12px] font-bold tabular-nums border-l border-slate-300 text-slate-900">
                    {formatEerr(data.total)}
                  </td>
                  {showYoy && (() => {
                    const yoy = yoyVariance(data.total, data.totalPriorYear || null);
                    return (
                      <td
                        className={cn(
                          "px-3 py-3 text-right text-[12px] font-bold tabular-nums",
                          yoy == null
                            ? "text-slate-400"
                            : yoy > 0
                              ? "text-rose-600"
                              : "text-emerald-700"
                        )}
                      >
                        {yoy != null ? formatPercent(yoy) : "—"}
                      </td>
                    );
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>
    </main>
  );
}
