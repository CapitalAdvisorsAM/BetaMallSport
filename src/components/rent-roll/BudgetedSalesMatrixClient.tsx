"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { Button } from "@/components/ui/button";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import { useBudgetedSalesCellApi } from "@/hooks/useBudgetedSalesCellApi";
import { cn, formatClp, formatDecimal } from "@/lib/utils";
import type { BudgetedSalesMatrixResponse } from "@/types/rent-roll";

type BudgetedSalesMatrixClientProps = {
  selectedProjectId: string;
  desde: string;
  hasta: string;
  data: BudgetedSalesMatrixResponse;
  canEdit: boolean;
};

type ViewMode = "pesos" | "pesosm2";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatPeriodShort(period: string): string {
  const [y, m] = period.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}

function formatCell(value: number | null, mode: ViewMode, glam2: number): string {
  if (value === null) return "—";
  if (mode === "pesosm2") {
    if (glam2 <= 0) return "—";
    return formatDecimal(value / glam2);
  }
  return formatClp(value);
}

function cellKey(tenantId: string, period: string): string {
  return `${tenantId}__${period}`;
}

type EditableCellProps = {
  tenantId: string;
  period: string;
  value: number | null;
  glam2: number;
  mode: ViewMode;
  isSaving: boolean;
  onSave: (tenantId: string, period: string, nextRaw: string) => Promise<void>;
};

function EditableCell({
  tenantId,
  period,
  value,
  glam2,
  mode,
  isSaving,
  onSave,
}: EditableCellProps): JSX.Element {
  const initial = value !== null ? String(value) : "";
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);

  if (mode === "pesosm2") {
    return (
      <span
        className="text-slate-400"
        title="Cambia a Pesos para editar"
      >
        {formatCell(value, mode, glam2)}
      </span>
    );
  }

  function handleBlur(): void {
    setEditing(false);
    const normalized = draft.trim();
    const normalizedInitial = initial.trim();
    if (normalized === normalizedInitial) return;
    void onSave(tenantId, period, normalized);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(initial);
      requestAnimationFrame(() => event.currentTarget.blur());
    }
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      step="1"
      min="0"
      value={editing ? draft : initial}
      disabled={isSaving}
      onFocus={(event) => {
        setEditing(true);
        setDraft(initial);
        event.currentTarget.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="—"
      className={cn(
        "w-24 rounded-md border border-transparent bg-transparent px-2 py-1 text-right tabular-nums text-slate-700",
        "hover:border-slate-200 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500",
        isSaving && "opacity-60",
        value === null && !editing && "text-slate-300",
      )}
    />
  );
}

export function BudgetedSalesMatrixClient({
  selectedProjectId,
  desde,
  hasta,
  data,
  canEdit,
}: BudgetedSalesMatrixClientProps): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<ViewMode>("pesos");
  const [localDesde, setLocalDesde] = useState(desde);
  const [localHasta, setLocalHasta] = useState(hasta);
  const { saveCell } = useBudgetedSalesCellApi();

  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const applyRange = (nextDesde: string, nextHasta: string) => {
    setLocalDesde(nextDesde);
    setLocalHasta(nextHasta);
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    if (nextDesde) params.set("desde", nextDesde);
    if (nextHasta) params.set("hasta", nextHasta);
    startTransition(() => {
      router.replace(`/rent-roll/budgeted-sales?${params.toString()}`);
    });
  };

  function getCellValue(tenantId: string, period: string, raw: number | null): number | null {
    const key = cellKey(tenantId, period);
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      return overrides[key];
    }
    return raw;
  }

  async function handleSaveCell(
    tenantId: string,
    period: string,
    nextRaw: string,
  ): Promise<void> {
    const key = cellKey(tenantId, period);
    const salesPesos = nextRaw === "" ? null : nextRaw;
    const parsedNumber = salesPesos === null ? null : Number(salesPesos);

    if (salesPesos !== null && (Number.isNaN(parsedNumber) || (parsedNumber ?? 0) < 0)) {
      toast.error("Ingresa un numero valido (>= 0).");
      return;
    }

    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      const response = await saveCell({
        projectId: selectedProjectId,
        tenantId,
        period,
        salesPesos,
      });
      const nextValue = response.salesPesos === null ? null : Number(response.salesPesos);
      setOverrides((prev) => ({ ...prev, [key]: nextValue }));
      toast.success(salesPesos === null ? "Celda borrada." : "Valor guardado.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar.");
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const rowsWithOverrides = useMemo(() => {
    return data.rows.map((row) => {
      const byPeriod: Record<string, number | null> = { ...row.byPeriod };
      let total = 0;
      const missingPeriods: string[] = [];
      for (const p of data.periods) {
        const value = getCellValue(row.tenantId, p, row.byPeriod[p] ?? null);
        byPeriod[p] = value;
        if (value === null) {
          missingPeriods.push(p);
        } else {
          total += value;
        }
      }
      return { ...row, byPeriod, total, missingPeriods };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, overrides]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of data.periods) totals[p] = 0;
    for (const row of rowsWithOverrides) {
      for (const p of data.periods) {
        const v = row.byPeriod[p];
        if (v !== null && v !== undefined) totals[p] += v;
      }
    }
    return totals;
  }, [data.periods, rowsWithOverrides]);

  const totalBudgetPesos = useMemo(
    () => rowsWithOverrides.reduce((acc, row) => acc + row.total, 0),
    [rowsWithOverrides],
  );

  const tenantsWithData = rowsWithOverrides.filter((row) =>
    data.periods.some((p) => row.byPeriod[p] !== null && row.byPeriod[p] !== undefined),
  ).length;

  const tenantsWithMissing = rowsWithOverrides.filter((row) => {
    const hasAny = data.periods.some((p) => row.byPeriod[p] !== null && row.byPeriod[p] !== undefined);
    return hasAny && row.missingPeriods.length > 0;
  }).length;

  const hasRows = rowsWithOverrides.length > 0;

  const description = canEdit
    ? "Matriz mensual editable: haz clic en una celda para ingresar o corregir el presupuesto. Use el toggle para ver Pesos totales o Pesos/m²."
    : "Matriz mensual de ventas presupuestadas cargadas por arrendatario. Use el toggle para ver Pesos totales o Pesos/m².";

  return (
    <main className={cn("space-y-4", isPending && "opacity-60")}>
      <ModuleHeader
        title="Ventas Presupuestadas por Arrendatario"
        description={description}
        actions={
          <ProjectPeriodToolbar
            desde={localDesde}
            hasta={localHasta}
            onDesdeChange={(value) => applyRange(value, localHasta)}
            onHastaChange={(value) => applyRange(localDesde, value)}
          />
        }
      />

      {!hasRows ? (
        <ModuleSectionCard>
          <ModuleEmptyState
            message="No hay arrendatarios en el proyecto para cargar ventas presupuestadas."
            actionHref="/finance/upload"
            actionLabel="Cargar ventas presupuestadas"
          />
        </ModuleSectionCard>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <KpiCard
              title="Presupuesto total (Pesos)"
              value={formatClp(totalBudgetPesos)}
              subtitle={`${data.periods.length} meses en rango`}
              accent="slate"
            />
            <KpiCard
              title="Arrendatarios con datos"
              value={tenantsWithData}
              subtitle={
                tenantsWithData > 0
                  ? `${data.periods.length * tenantsWithData} celdas posibles`
                  : "—"
              }
              accent="green"
            />
            <KpiCard
              title="Con meses faltantes"
              value={tenantsWithMissing}
              subtitle={
                tenantsWithMissing > 0
                  ? "Revisar carga de ventas presupuestadas"
                  : "Todos los meses cargados"
              }
              accent={tenantsWithMissing > 0 ? "yellow" : "green"}
            />
          </section>

          <ModuleSectionCard
            title="Desglose mensual"
            headerAction={
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                <Button
                  type="button"
                  variant={mode === "pesos" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("pesos")}
                  className="rounded-none"
                >
                  Pesos
                </Button>
                <Button
                  type="button"
                  variant={mode === "pesosm2" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMode("pesosm2")}
                  className="rounded-none"
                >
                  Pesos/m²
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className={tableTheme.table}>
                <thead className={tableTheme.head}>
                  <tr>
                    <th className={cn(tableTheme.headCell, "sticky left-0 z-10 bg-brand-700")}>
                      Arrendatario
                    </th>
                    <th className={cn(tableTheme.compactHeadCell, "text-right")}>GLA (m²)</th>
                    {data.periods.map((p) => (
                      <th key={p} className={cn(tableTheme.compactHeadCell, "text-right")}>
                        {formatPeriodShort(p)}
                      </th>
                    ))}
                    <th className={cn(tableTheme.compactHeadCell, "text-right")}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rowsWithOverrides.map((row, index) => (
                    <tr
                      key={row.tenantId}
                      className={cn(getStripedRowClass(index), tableTheme.rowHover)}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <span>{row.nombreComercial}</span>
                          {row.missingPeriods.length > 0 && row.missingPeriods.length < data.periods.length && (
                            <span
                              className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                              title={`Sin datos en: ${row.missingPeriods.join(", ")}`}
                            >
                              {row.missingPeriods.length} sin datos
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{row.rut}</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {row.glam2 > 0 ? formatDecimal(row.glam2) : "—"}
                      </td>
                      {data.periods.map((p) => {
                        const value = row.byPeriod[p] ?? null;
                        const key = cellKey(row.tenantId, p);
                        const isSaving = savingKeys.has(key);
                        return (
                          <td
                            key={p}
                            className={cn(
                              "px-1 py-2 text-right tabular-nums",
                              canEdit ? "bg-inherit" : value === null ? "text-slate-300" : "text-slate-700",
                            )}
                          >
                            {canEdit ? (
                              <EditableCell
                                tenantId={row.tenantId}
                                period={p}
                                value={value}
                                glam2={row.glam2}
                                mode={mode}
                                isSaving={isSaving}
                                onSave={handleSaveCell}
                              />
                            ) : (
                              <span className="px-3 py-1">{formatCell(value, mode, row.glam2)}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">
                        {mode === "pesosm2"
                          ? row.glam2 > 0
                            ? formatDecimal(row.total / row.glam2)
                            : "—"
                          : formatClp(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                  <tr>
                    <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                      Total
                    </td>
                    <td className="px-3 py-3" />
                    {data.periods.map((p) => (
                      <td
                        key={p}
                        className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800"
                      >
                        {mode === "pesos" ? formatClp(columnTotals[p] ?? 0) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {mode === "pesos" ? formatClp(totalBudgetPesos) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ModuleSectionCard>
        </>
      )}
    </main>
  );
}
