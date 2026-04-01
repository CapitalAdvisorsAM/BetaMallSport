"use client";

import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn, formatDateString, formatDecimal } from "@/lib/utils";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { useDataTable } from "@/hooks/useDataTable";
import type { RentRollRow } from "@/types/rent-roll";

type AlertaFiltro = "NINGUNA" | "VENCE_30" | "VENCE_31_60" | "GRACIA" | "VACANTE";

type RentRollTableProps = {
  rows: RentRollRow[];
  proyectoId: string;
  periodo: string;
};

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
  return formatDecimal(value);
}

function toCsvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function getNumberRange(
  value: unknown
): [number | undefined, number | undefined] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const min = typeof value[0] === "number" ? value[0] : undefined;
  const max = typeof value[1] === "number" ? value[1] : undefined;
  if (min === undefined && max === undefined) {
    return undefined;
  }
  return [min, max];
}

function isSingleEstadoFilter(value: unknown, expected: RentRollRow["estado"]): boolean {
  return Array.isArray(value) && value.length === 1 && value[0] === expected;
}

export function RentRollTable({ rows, proyectoId, periodo }: RentRollTableProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortedBaseRows = useMemo(
    () => [...rows].sort((a, b) => a.localCodigo.localeCompare(b.localCodigo, "es-CL")),
    [rows]
  );

  const columns = useMemo<ColumnDef<RentRollRow, unknown>[]>(
    () => [
      {
        accessorKey: "localCodigo",
        header: "Local",
        filterFn: "includesString",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium text-slate-900">
            {row.original.localCodigo} - {row.original.localNombre}
          </span>
        )
      },
      {
        accessorKey: "arrendatario",
        header: "Arrendatario",
        filterFn: "includesString",
        cell: ({ row }) => {
          const isVacante = row.original.estado === "VACANTE";
          return (
            <span className="whitespace-nowrap text-slate-700">
              {isVacante ? "-" : (row.original.arrendatario ?? "-")}
            </span>
          );
        }
      },
      {
        accessorKey: "estado",
        header: "Estado",
        filterFn: (row, columnId, filterValue) => {
          if (!Array.isArray(filterValue) || filterValue.length === 0) {
            return true;
          }
          return filterValue.includes(String(row.getValue(columnId)));
        },
        meta: { filterOptions: ["OCUPADO", "GRACIA", "VACANTE"], filterType: "enum" },
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
              getEstadoBadge(row.original.estado)
            )}
          >
            {row.original.estado}
          </span>
        )
      },
      {
        id: "glam2",
        accessorFn: (row) => row.glam2,
        header: "GLA m²",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap text-slate-700">{formatDecimal(row.original.glam2)}</span>
      },
      {
        id: "ggccUf",
        accessorFn: (row) => row.ggccUf ?? undefined,
        header: "GGCC",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => {
          const isVacante = row.original.estado === "VACANTE";
          return <span className="whitespace-nowrap text-slate-700">{renderMetric(row.original.ggccUf, isVacante)}</span>;
        }
      },
      {
        accessorKey: "fechaTermino",
        header: "Vence",
        enableColumnFilter: false,
        enableSorting: false,
        meta: { align: "center" },
        cell: ({ row }) => {
          const isVacante = row.original.estado === "VACANTE";
          return <span className="whitespace-nowrap text-slate-700">{isVacante ? "-" : formatDateString(row.original.fechaTermino)}</span>;
        }
      },
      {
        id: "diasParaVencimiento",
        accessorFn: (row) => row.diasParaVencimiento ?? undefined,
        header: "Días",
        enableColumnFilter: false,
        filterFn: "inNumberRange",
        sortUndefined: "last",
        meta: { align: "center", filterType: "number" },
        cell: ({ row }) => {
          if (row.original.diasParaVencimiento === null) {
            return "-";
          }
          return (
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
                getDiasBadge(row.original.diasParaVencimiento)
              )}
            >
              {row.original.diasParaVencimiento}
            </span>
          );
        }
      },
      {
        id: "rentaFijaAnual",
        accessorFn: (row) => (row.rentaFijaUf ?? undefined),
        header: "Renta Fija por Año",
        enableColumnFilter: false,
        sortUndefined: "last",
        meta: { align: "right" },
        cell: ({ row }) => {
          const isVacante = row.original.estado === "VACANTE";
          const anual = row.original.rentaFijaUf !== null ? row.original.rentaFijaUf * 12 : null;
          return <span className="whitespace-nowrap text-slate-700">{renderMetric(anual, isVacante)}</span>;
        }
      }
    ],
    []
  );

  const { table } = useDataTable(sortedBaseRows, columns);

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

  const filteredRows = table.getFilteredRowModel().rows.map((row) => row.original);
  const sortedRows = table.getSortedRowModel().rows.map((row) => row.original);

  const totals = useMemo(() => {
    const ocupados = filteredRows.filter((row) => row.estado === "OCUPADO");
    const glaTotal = filteredRows.reduce((acc, row) => acc + row.glam2, 0);
    const ggccUf = filteredRows.reduce((acc, row) => acc + (row.ggccUf ?? 0), 0);
    const rentaFijaAnualOcupadosUf = ocupados.reduce((acc, row) => acc + ((row.rentaFijaUf ?? 0) * 12), 0);

    return {
      glaTotal,
      ggccUf,
      rentaFijaAnualOcupadosUf
    };
  }, [filteredRows]);

  const onPeriodoChange = (nextPeriodo: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("proyecto", proyectoId);
    params.set("periodo", nextPeriodo);
    router.push(`${pathname}?${params.toString()}`);
  };

  const estadoFilterValue = table.getColumn("estado")?.getFilterValue();
  const diasFilterValue = table.getColumn("diasParaVencimiento")?.getFilterValue();
  const diasRange = getNumberRange(diasFilterValue);

  const activeQuickFilter: AlertaFiltro = useMemo(() => {
    if (diasRange && diasRange[0] === undefined && diasRange[1] === 30) {
      return "VENCE_30";
    }
    if (diasRange && diasRange[0] === 31 && diasRange[1] === 60) {
      return "VENCE_31_60";
    }
    if (isSingleEstadoFilter(estadoFilterValue, "GRACIA")) {
      return "GRACIA";
    }
    if (isSingleEstadoFilter(estadoFilterValue, "VACANTE")) {
      return "VACANTE";
    }
    return "NINGUNA";
  }, [diasRange, estadoFilterValue]);

  const clearQuickFilter = (): void => {
    table.getColumn("estado")?.setFilterValue(undefined);
    table.getColumn("diasParaVencimiento")?.setFilterValue(undefined);
  };

  const applyQuickFilter = (alerta: AlertaFiltro): void => {
    if (alerta === "VENCE_30") {
      table.getColumn("estado")?.setFilterValue(undefined);
      table.getColumn("diasParaVencimiento")?.setFilterValue([undefined, 30]);
      return;
    }
    if (alerta === "VENCE_31_60") {
      table.getColumn("estado")?.setFilterValue(undefined);
      table.getColumn("diasParaVencimiento")?.setFilterValue([31, 60]);
      return;
    }
    if (alerta === "GRACIA") {
      table.getColumn("diasParaVencimiento")?.setFilterValue(undefined);
      table.getColumn("estado")?.setFilterValue(["GRACIA"]);
      return;
    }
    if (alerta === "VACANTE") {
      table.getColumn("diasParaVencimiento")?.setFilterValue(undefined);
      table.getColumn("estado")?.setFilterValue(["VACANTE"]);
      return;
    }
    clearQuickFilter();
  };

  const onExportCsv = (): void => {
    const headers = [
      "Local",
      "Arrendatario",
      "Estado",
      "GLA m2",
      "GGCC UF",
      "Fecha Término",
      "Días para Vencer",
      "Renta Fija por Año"
    ];

    const csvRows = sortedRows.map((row) => [
      row.localCodigo,
      row.arrendatario ?? "Vacante",
      row.estado,
      row.glam2,
      row.ggccUf ?? "",
      row.fechaTermino ?? "",
      row.diasParaVencimiento ?? "",
      row.rentaFijaUf !== null ? row.rentaFijaUf * 12 : ""
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
        <Button
          type="button"
          variant="outline"
          onClick={onExportCsv}
          className="rounded-full"
        >
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => applyQuickFilter("VENCE_30")}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm shadow-sm transition hover:bg-rose-50",
            activeQuickFilter === "VENCE_30" ? "border-rose-400 bg-rose-50" : "border-slate-200"
          )}
        >
          <p className="font-semibold text-rose-700">🔴 {alertas.vence30} locales</p>
          <p className="text-xs text-slate-600">Vencen en ≤30 dias</p>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => applyQuickFilter("VENCE_31_60")}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm shadow-sm transition hover:bg-amber-50",
            activeQuickFilter === "VENCE_31_60" ? "border-amber-400 bg-amber-50" : "border-slate-200"
          )}
        >
          <p className="font-semibold text-amber-700">🟡 {alertas.vence31_60} locales</p>
          <p className="text-xs text-slate-600">Vencen en 31-60 dias</p>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => applyQuickFilter("GRACIA")}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm shadow-sm transition hover:bg-amber-50",
            activeQuickFilter === "GRACIA" ? "border-amber-400 bg-amber-50" : "border-slate-200"
          )}
        >
          <p className="font-semibold text-amber-700">🟠 {alertas.enGracia} locales</p>
          <p className="text-xs text-slate-600">En periodo de gracia</p>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => applyQuickFilter("VACANTE")}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm shadow-sm transition hover:bg-slate-100",
            activeQuickFilter === "VACANTE" ? "border-slate-400 bg-slate-100" : "border-slate-200"
          )}
        >
          <p className="font-semibold text-slate-700">⬜ {alertas.vacantes} locales</p>
          <p className="text-xs text-slate-600">Vacantes</p>
        </Button>
      </div>

      <div className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[220px_auto]">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Periodo</span>
          <Input
            type="month"
            value={periodo}
            onChange={(event) => onPeriodoChange(event.target.value)}
            className="text-sm"
          />
        </label>

        <Button
          type="button"
          variant="outline"
          onClick={clearQuickFilter}
          className="self-end h-auto px-3 py-2 text-sm"
        >
          Limpiar alerta activa
        </Button>
      </div>

      <DataTable
        table={table}
        emptyMessage="No hay locales que cumplan los filtros seleccionados."
        footerContent={
          sortedRows.length > 0 ? (
            <TableRow className="sticky bottom-0 z-10 border-t-2 border-brand-500 bg-brand-50 font-semibold text-slate-900 hover:bg-brand-50">
              <TableCell className="whitespace-nowrap px-4 py-3 font-bold">TOTAL</TableCell>
              <TableCell className="px-4 py-3" />
              <TableCell className="px-4 py-3" />
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.glaTotal)}
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.ggccUf)}
              </TableCell>
              <TableCell className="px-4 py-3" />
              <TableCell className="px-4 py-3" />
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.rentaFijaAnualOcupadosUf)}
              </TableCell>
            </TableRow>
          ) : null
        }
      />
    </section>
  );
}
