"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { OccupancyBadge } from "@/components/finanzas/OccupancyBadge";
import { Button } from "@/components/ui/button";
import { buildExportExcelUrl } from "@/lib/export/shared";
import type { ProjectOption, TenantFinanceRow } from "@/types/finanzas";
import { formatUf } from "@/lib/utils";

type ArrendatariosFinanzasClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Arrendatario
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Locales
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Facturacion Total UF
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ventas UF
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Costo Ocupacion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((tenant) => (
                  <Fragment key={tenant.id}>
                    <tr
                      className="cursor-pointer hover:bg-slate-50/60"
                      onClick={() => setExpandedId(expandedId === tenant.id ? null : tenant.id)}
                    >
                      <td className="sticky left-0 bg-white px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">{expandedId === tenant.id ? "▼" : "▶"}</span>
                          {tenant.nombreComercial}
                        </div>
                        <p className="text-xs text-slate-400">{tenant.rut}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {tenant.locales.map((local) => local.codigo).join(", ")}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">
                        {formatUf(tenant.totalFacturado)} UF
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">
                        {tenant.totalVentas > 0 ? `${formatUf(tenant.totalVentas)} UF` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <OccupancyBadge pct={tenant.costoOcupacion} />
                      </td>
                    </tr>

                    {expandedId === tenant.id && periods.length > 0 ? (
                      <tr key={`${tenant.id}-detalle`} className="bg-slate-50/40">
                        <td colSpan={5} className="px-4 py-3">
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
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>
    </main>
  );
}
