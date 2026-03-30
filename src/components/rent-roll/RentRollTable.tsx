"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RentRollRow } from "@/types/rent-roll";

type EstadoFiltro = "TODOS" | "OCUPADO" | "GRACIA" | "VACANTE";
type AlertaFiltro = "NINGUNA" | "VENCE_30" | "VENCE_31_60" | "GRACIA" | "VACANTE";
type NumericSortKey =
  | "glam2"
  | "tarifaUfM2"
  | "rentaFijaUf"
  | "ggccUf"
  | "ventasUf"
  | "diasParaVencimiento";

type RentRollTableProps = {
  rows: RentRollRow[];
  proyectoId: string;
  periodo: string;
};

function formatNumber(value: number): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString("es-CL");
}

function getEstadoBadge(estado: RentRollRow["estado"]): string {
  if (estado === "OCUPADO") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (estado === "GRACIA") {
    return "bg-amber-100 text-amber-700";
  }
  if (estado === "VACANTE") {
    return "bg-slate-200 text-slate-700";
  }
  return "bg-rose-100 text-rose-700";
}

function getDiasBadge(days: number | null): string {
  if (days === null) {
    return "bg-slate-100 text-slate-600";
  }
  if (days <= 30) {
    return "bg-rose-100 text-rose-700";
  }
  if (days <= 60) {
    return "bg-amber-100 text-amber-700";
  }
  if (days <= 90) {
    return "bg-gold-400/25 text-amber-900";
  }
  return "bg-slate-100 text-slate-700";
}

function renderMetric(value: number | null, isVacante: boolean): string {
  if (isVacante || value === null) {
    return "-";
  }
  return formatNumber(value);
}

function isNumericSortKey(value: keyof RentRollRow | null): value is NumericSortKey {
  return (
    value === "glam2" ||
    value === "tarifaUfM2" ||
    value === "rentaFijaUf" ||
    value === "ggccUf" ||
    value === "ventasUf" ||
    value === "diasParaVencimiento"
  );
}

function getSortValue(row: RentRollRow, key: NumericSortKey): number | null {
  if (key === "glam2") {
    return row.glam2;
  }
  return row[key];
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  sortDir: "asc" | "desc"
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return sortDir === "asc" ? left - right : right - left;
}

function getSortIndicator(
  key: NumericSortKey,
  sortKey: keyof RentRollRow | null,
  sortDir: "asc" | "desc"
): string {
  if (sortKey !== key) {
    return "↕";
  }
  return sortDir === "asc" ? "↑" : "↓";
}

function toCsvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function RentRollTable({ rows, proyectoId, periodo }: RentRollTableProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("TODOS");
  const [soloProximos, setSoloProximos] = useState(false);
  const [alertaFiltro, setAlertaFiltro] = useState<AlertaFiltro>("NINGUNA");
  const [sortKey, setSortKey] = useState<keyof RentRollRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const alertas = useMemo(() => {
    const vence30 = rows.filter(
      (row) => row.diasParaVencimiento !== null && row.diasParaVencimiento <= 30
    ).length;
    const vence31_60 = rows.filter(
      (row) =>
        row.diasParaVencimiento !== null &&
        row.diasParaVencimiento >= 31 &&
        row.diasParaVencimiento <= 60
    ).length;
    const enGracia = rows.filter((row) => row.estado === "GRACIA").length;
    const vacantes = rows.filter((row) => row.estado === "VACANTE").length;

    return { vence30, vence31_60, enGracia, vacantes };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const baseRows = [...rows].sort((a, b) => a.localCodigo.localeCompare(b.localCodigo, "es-CL"));
    return baseRows.filter((row) => {
      if (estadoFiltro !== "TODOS" && row.estado !== estadoFiltro) {
        return false;
      }

      if (soloProximos && (row.diasParaVencimiento === null || row.diasParaVencimiento > 90)) {
        return false;
      }

      if (alertaFiltro === "VENCE_30") {
        return row.diasParaVencimiento !== null && row.diasParaVencimiento <= 30;
      }
      if (alertaFiltro === "VENCE_31_60") {
        return (
          row.diasParaVencimiento !== null &&
          row.diasParaVencimiento >= 31 &&
          row.diasParaVencimiento <= 60
        );
      }
      if (alertaFiltro === "GRACIA") {
        return row.estado === "GRACIA";
      }
      if (alertaFiltro === "VACANTE") {
        return row.estado === "VACANTE";
      }

      return true;
    });
  }, [rows, estadoFiltro, soloProximos, alertaFiltro]);

  const sortedRows = useMemo(() => {
    if (!isNumericSortKey(sortKey)) {
      return filteredRows;
    }

    return [...filteredRows].sort((left, right) => {
      const comparison = compareNullableNumbers(
        getSortValue(left, sortKey),
        getSortValue(right, sortKey),
        sortDir
      );
      if (comparison !== 0) {
        return comparison;
      }
      return left.localCodigo.localeCompare(right.localCodigo, "es-CL");
    });
  }, [filteredRows, sortKey, sortDir]);

  const totals = useMemo(() => {
    const ocupados = filteredRows.filter((row) => row.estado === "OCUPADO");
    const glaTotal = filteredRows.reduce((acc, row) => acc + row.glam2, 0);
    const tarifaNumerador = ocupados.reduce((acc, row) => {
      if (row.tarifaUfM2 === null) {
        return acc;
      }
      return acc + row.tarifaUfM2 * row.glam2;
    }, 0);
    const tarifaDenominador = ocupados.reduce((acc, row) => {
      if (row.tarifaUfM2 === null) {
        return acc;
      }
      return acc + row.glam2;
    }, 0);
    const tarifaPonderadaUfM2 =
      tarifaDenominador > 0 ? tarifaNumerador / tarifaDenominador : null;
    const rentaFijaOcupadosUf = ocupados.reduce((acc, row) => acc + (row.rentaFijaUf ?? 0), 0);
    const ggccUf = filteredRows.reduce((acc, row) => acc + (row.ggccUf ?? 0), 0);
    const ventasUf = filteredRows.reduce((acc, row) => acc + (row.ventasUf ?? 0), 0);

    return {
      glaTotal,
      tarifaPonderadaUfM2,
      rentaFijaOcupadosUf,
      ggccUf,
      ventasUf
    };
  }, [filteredRows]);

  const onPeriodoChange = (nextPeriodo: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("proyecto", proyectoId);
    params.set("periodo", nextPeriodo);
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearQuickFilter = (): void => {
    setAlertaFiltro("NINGUNA");
  };

  const onSortChange = (nextKey: NumericSortKey): void => {
    if (sortKey === nextKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  };

  const onExportCsv = (): void => {
    const headers = [
      "Local",
      "Arrendatario",
      "Estado",
      "GLA m2",
      "Tarifa UF/m2",
      "Renta Fija UF",
      "GGCC UF",
      "Ventas UF",
      "Fecha Término",
      "Días para Vencer"
    ];

    const csvRows = sortedRows.map((row) => [
      row.localCodigo,
      row.arrendatario ?? "Vacante",
      row.estado,
      row.glam2,
      row.tarifaUfM2 ?? "",
      row.rentaFijaUf ?? "",
      row.ggccUf ?? "",
      row.ventasUf ?? "",
      row.fechaTermino ?? "",
      row.diasParaVencimiento ?? ""
    ]);

    const csv = [headers, ...csvRows].map((row) => row.map(toCsvCell).join(",")).join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rent-roll-${periodo}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4 rounded-md bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Tabla de locales</h3>
        <button
          type="button"
          onClick={onExportCsv}
          className="rounded-full border border-brand-500 px-4 py-2 text-sm font-medium text-brand-500 hover:bg-brand-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setEstadoFiltro("TODOS");
            setSoloProximos(false);
            setAlertaFiltro("VENCE_30");
          }}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm shadow-sm transition hover:bg-rose-50",
            alertaFiltro === "VENCE_30" ? "border-rose-400 bg-rose-50" : "border-slate-200"
          )}
        >
          <p className="font-semibold text-rose-700">🔴 {alertas.vence30} locales</p>
          <p className="text-xs text-slate-600">Vencen en ≤30 dias</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setEstadoFiltro("TODOS");
            setSoloProximos(false);
            setAlertaFiltro("VENCE_31_60");
          }}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm shadow-sm transition hover:bg-amber-50",
            alertaFiltro === "VENCE_31_60" ? "border-amber-400 bg-amber-50" : "border-slate-200"
          )}
        >
          <p className="font-semibold text-amber-700">🟡 {alertas.vence31_60} locales</p>
          <p className="text-xs text-slate-600">Vencen en 31-60 dias</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setEstadoFiltro("GRACIA");
            setSoloProximos(false);
            setAlertaFiltro("GRACIA");
          }}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm shadow-sm transition hover:bg-amber-50",
            alertaFiltro === "GRACIA" ? "border-amber-400 bg-amber-50" : "border-slate-200"
          )}
        >
          <p className="font-semibold text-amber-700">🟠 {alertas.enGracia} locales</p>
          <p className="text-xs text-slate-600">En periodo de gracia</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setEstadoFiltro("VACANTE");
            setSoloProximos(false);
            setAlertaFiltro("VACANTE");
          }}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm shadow-sm transition hover:bg-slate-100",
            alertaFiltro === "VACANTE" ? "border-slate-400 bg-slate-100" : "border-slate-200"
          )}
        >
          <p className="font-semibold text-slate-700">⬜ {alertas.vacantes} locales</p>
          <p className="text-xs text-slate-600">Vacantes</p>
        </button>
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[220px_220px_auto_auto]">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Periodo</span>
          <input
            type="month"
            value={periodo}
            onChange={(event) => onPeriodoChange(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estado</span>
          <select
            value={estadoFiltro}
            onChange={(event) => setEstadoFiltro(event.target.value as EstadoFiltro)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          >
            <option value="TODOS">Todos</option>
            <option value="OCUPADO">Ocupado</option>
            <option value="GRACIA">Gracia</option>
            <option value="VACANTE">Vacante</option>
          </select>
        </label>

        <label className="flex items-center gap-2 self-end rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={soloProximos}
            onChange={(event) => setSoloProximos(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          ⚠ Proximos a vencer (≤90 dias)
        </label>

        <button
          type="button"
          onClick={clearQuickFilter}
          className="self-end rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Limpiar alerta activa
        </button>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-brand-700">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Local
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Arrendatario
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Estado
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                  <button
                    type="button"
                    onClick={() => onSortChange("glam2")}
                    className="inline-flex w-full items-center justify-end gap-1"
                  >
                    <span>GLA m2</span>
                    <span aria-hidden="true">{getSortIndicator("glam2", sortKey, sortDir)}</span>
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                  <button
                    type="button"
                    onClick={() => onSortChange("tarifaUfM2")}
                    className="inline-flex w-full items-center justify-end gap-1"
                  >
                    <span>Tarifa UF/m2</span>
                    <span aria-hidden="true">{getSortIndicator("tarifaUfM2", sortKey, sortDir)}</span>
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                  <button
                    type="button"
                    onClick={() => onSortChange("rentaFijaUf")}
                    className="inline-flex w-full items-center justify-end gap-1"
                  >
                    <span>Renta Fija UF</span>
                    <span aria-hidden="true">{getSortIndicator("rentaFijaUf", sortKey, sortDir)}</span>
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                  <button
                    type="button"
                    onClick={() => onSortChange("ggccUf")}
                    className="inline-flex w-full items-center justify-end gap-1"
                  >
                    <span>GGCC UF</span>
                    <span aria-hidden="true">{getSortIndicator("ggccUf", sortKey, sortDir)}</span>
                  </button>
                </th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                  <button
                    type="button"
                    onClick={() => onSortChange("ventasUf")}
                    className="inline-flex w-full items-center justify-end gap-1"
                  >
                    <span>Ventas UF</span>
                    <span aria-hidden="true">{getSortIndicator("ventasUf", sortKey, sortDir)}</span>
                  </button>
                </th>
                <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-white/70">
                  Vence
                </th>
                <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-white/70">
                  <button
                    type="button"
                    onClick={() => onSortChange("diasParaVencimiento")}
                    className="inline-flex items-center justify-center gap-1"
                  >
                    <span>Dias</span>
                    <span aria-hidden="true">
                      {getSortIndicator("diasParaVencimiento", sortKey, sortDir)}
                    </span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => {
                const isVacante = row.estado === "VACANTE";
                return (
                  <tr
                    key={row.localId}
                    className={cn(
                      "transition-colors hover:bg-brand-50",
                      isVacante ? "bg-slate-50" : index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {row.localCodigo} - {row.localNombre}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {isVacante ? "-" : (row.arrendatario ?? "-")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
                          getEstadoBadge(row.estado)
                        )}
                      >
                        {row.estado}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {formatNumber(row.glam2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {renderMetric(row.tarifaUfM2, isVacante)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {renderMetric(row.rentaFijaUf, isVacante)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {renderMetric(row.ggccUf, isVacante)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {renderMetric(row.ventasUf, isVacante)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-slate-700">
                      {isVacante ? "-" : formatDate(row.fechaTermino)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {row.diasParaVencimiento === null ? (
                        "-"
                      ) : (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
                            getDiasBadge(row.diasParaVencimiento)
                          )}
                        >
                          {row.diasParaVencimiento}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {sortedRows.length > 0 ? (
              <tfoot className="sticky bottom-0 z-10">
                <tr className="border-t-2 border-brand-500 bg-brand-50 font-semibold text-slate-900">
                  <td className="whitespace-nowrap px-4 py-3 font-bold">TOTAL</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatNumber(totals.glaTotal)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {totals.tarifaPonderadaUfM2 === null ? "-" : formatNumber(totals.tarifaPonderadaUfM2)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatNumber(totals.rentaFijaOcupadosUf)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatNumber(totals.ggccUf)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatNumber(totals.ventasUf)}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {sortedRows.length === 0 ? (
          <p className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-500">
            No hay locales que cumplan los filtros seleccionados.
          </p>
        ) : null}
      </div>
    </section>
  );
}
