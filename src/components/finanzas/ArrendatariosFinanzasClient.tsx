"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { OccupancyBadge } from "@/components/finanzas/OccupancyBadge";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/button";
import { useDataTable } from "@/hooks/useDataTable";
import { buildExportExcelUrl } from "@/lib/export/shared";
import { formatUf } from "@/lib/utils";
import type { ProjectOption, TenantFinanceRow } from "@/types/finanzas";

type ArrendatariosFinanzasClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

const columns: ColumnDef<TenantFinanceRow, unknown>[] = [
  {
    accessorKey: "nombreComercial",
    header: "Arrendatario",
    meta: { filterType: "string" },
    cell: ({ row }) => (
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-2 text-left"
        onClick={() => row.toggleExpanded()}
      >
        <span className="mt-0.5 shrink-0 text-slate-300">{row.getIsExpanded() ? "▼" : "▶"}</span>
        <div>
          <p className="font-medium text-slate-800">{row.original.nombreComercial}</p>
          <p className="text-xs text-slate-400">{row.original.rut}</p>
        </div>
      </button>
    )
  },
  {
    id: "locales",
    header: "Locales",
    enableSorting: false,
    enableColumnFilter: false,
    accessorFn: (row) => row.locales.map((l) => l.codigo).join(", "),
    cell: ({ getValue }) => (
      <span className="text-slate-500">{getValue<string>()}</span>
    )
  },
  {
    accessorKey: "totalFacturado",
    header: "Facturacion Total UF",
    meta: { align: "right", filterType: "number" },
    cell: ({ getValue }) => (
      <span className="font-semibold text-slate-700">{formatUf(getValue<number>())} UF</span>
    )
  },
  {
    accessorKey: "totalVentas",
    header: "Ventas UF",
    meta: { align: "right" },
    enableColumnFilter: false,
    cell: ({ getValue }) => {
      const v = getValue<number>();
      return <span className="text-slate-600">{v > 0 ? `${formatUf(v)} UF` : "—"}</span>;
    }
  },
  {
    accessorKey: "costoOcupacion",
    header: "Costo Ocupacion",
    meta: { align: "center" },
    enableColumnFilter: false,
    cell: ({ getValue }) => <OccupancyBadge pct={getValue<number | null>()} />
  }
];

export function ArrendatariosFinanzasClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: ArrendatariosFinanzasClientProps): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<TenantFinanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId });
      if (desde) {
        params.set("desde", desde);
      }
      if (hasta) {
        params.set("hasta", hasta);
      }

      const response = await fetch(`/api/finanzas/arrendatario?${params.toString()}`);
      const payload = (await response.json()) as { arrendatarios?: TenantFinanceRow[] };
      setData(payload.arrendatarios ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const periods = useMemo(
    () => [...new Set(data.flatMap((tenant) => tenant.periodos))].sort(),
    [data]
  );

  const { table } = useDataTable(data, columns, { expandable: true });

  function renderPeriodDetail(row: Row<TenantFinanceRow>): React.ReactNode {
    const tenant = row.original;
    if (periods.length === 0) return null;

    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-1 text-left font-semibold text-slate-500">Periodo</th>
            <th className="pb-1 text-right font-semibold text-slate-500">Facturacion UF</th>
            <th className="pb-1 text-right font-semibold text-slate-500">Ventas UF</th>
            <th className="pb-1 text-center font-semibold text-slate-500">Costo Ocup.</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => {
            const billed = tenant.facturacionPorPeriodo[period] ?? 0;
            const sales = tenant.ventasPorPeriodo[period] ?? 0;
            const occupancy = sales > 0 ? (billed / sales) * 100 : null;

            return (
              <tr key={period} className="border-b border-slate-50">
                <td className="py-1 text-slate-600">{period}</td>
                <td className="py-1 text-right text-slate-700">
                  {billed > 0 ? formatUf(billed) : "—"}
                </td>
                <td className="py-1 text-right text-slate-600">
                  {sales > 0 ? formatUf(sales) : "—"}
                </td>
                <td className="py-1 text-center">
                  <OccupancyBadge pct={occupancy} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  const filteredExportHref = buildExportExcelUrl({
    dataset: "finanzas_arrendatarios",
    scope: "filtered",
    proyectoId: selectedProjectId,
    desde: desde || undefined,
    hasta: hasta || undefined
  });
  const allExportHref = buildExportExcelUrl({
    dataset: "finanzas_arrendatarios",
    scope: "all",
    proyectoId: selectedProjectId
  });

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Arrendatarios"
        description="Facturacion total versus ventas por arrendatario y costo de ocupacion."
        projects={projects}
        selectedProjectId={selectedProjectId}
        showProjectSelector={false}
        preserve={{ desde, hasta }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProjectPeriodToolbar
              desde={desde}
              hasta={hasta}
              onDesdeChange={setDesde}
              onHastaChange={setHasta}
            />
            <Button asChild type="button" variant="outline" size="sm">
              <a href={filteredExportHref}>Descargar filtrado</a>
            </Button>
            <Button asChild type="button" size="sm">
              <a href={allExportHref}>Descargar todo</a>
            </Button>
          </div>
        }
      />

      <ModuleSectionCard>
        {loading ? (
          <ModuleLoadingState />
        ) : data.length === 0 ? (
          <ModuleEmptyState
            message="Sin datos para el periodo seleccionado."
            actionHref={`/finanzas/upload?proyecto=${selectedProjectId}`}
            actionLabel="Cargar datos contables"
          />
        ) : (
          <DataTable
            table={table}
            emptyMessage="Sin arrendatarios para el periodo seleccionado."
            renderSubRow={renderPeriodDetail}
          />
        )}
      </ModuleSectionCard>
    </main>
  );
}
