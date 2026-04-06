"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { OccupancyBadge } from "@/components/finance/OccupancyBadge";
import type { ArrendatarioPartidaDetalle, ProjectOption, TenantFinanceRow } from "@/types/finance";
import { formatUf } from "@/lib/utils";

type FinanceTenantsClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

export function FinanceTenantsClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: FinanceTenantsClientProps): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<TenantFinanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Detalle por partida: clave "tenantId::periodo"
  const [partidaAbierta, setPartidaAbierta] = useState<string | null>(null);
  const [partidaCache, setPartidaCache] = useState<Map<string, ArrendatarioPartidaDetalle[]>>(new Map());
  const [loadingPartida, setLoadingPartida] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const response = await fetch(`/api/finance/tenants?${params.toString()}`);
      const payload = (await response.json()) as { arrendatarios?: TenantFinanceRow[] };
      setData(payload.arrendatarios ?? []);
      setExpandedId(null);
      setPartidaAbierta(null);
      setPartidaCache(new Map());
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

  async function togglePartida(tenantId: string, periodo: string): Promise<void> {
    const key = `${tenantId}::${periodo}`;
    if (partidaAbierta === key) {
      setPartidaAbierta(null);
      return;
    }
    setPartidaAbierta(key);
    if (partidaCache.has(key)) return;

    setLoadingPartida((prev) => new Set(prev).add(key));
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId, arrendatarioId: tenantId, periodo });
      const res = await fetch(`/api/finance/tenants/detail?${params.toString()}`);
      const payload = (await res.json()) as { partidas: ArrendatarioPartidaDetalle[] };
      setPartidaCache((prev) => new Map(prev).set(key, payload.partidas ?? []));
    } finally {
      setLoadingPartida((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Arrendatarios"
        description="Facturacion total versus ventas por arrendatario y costo de ocupacion."
        projects={projects}
        selectedProjectId={selectedProjectId}
        preserve={{ desde, hasta }}
        actions={
          <ProjectPeriodToolbar
            desde={desde}
            hasta={hasta}
            onDesdeChange={setDesde}
            onHastaChange={setHasta}
          />
        }
      />

      <ModuleSectionCard>
        {loading ? (
          <ModuleLoadingState />
        ) : data.length === 0 ? (
          <ModuleEmptyState
            message="Sin datos para el periodo seleccionado."
            actionHref={`/finance/upload?project=${selectedProjectId}`}
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
                    {/* Fila principal del arrendatario */}
                    <tr
                      className="cursor-pointer hover:bg-slate-50/60"
                      onClick={() => setExpandedId(expandedId === tenant.id ? null : tenant.id)}
                    >
                      <td className="sticky left-0 bg-white px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">{expandedId === tenant.id ? "â–¼" : "â–¶"}</span>
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
                        {tenant.totalVentas > 0 ? `${formatUf(tenant.totalVentas)} UF` : "â€”"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <OccupancyBadge pct={tenant.costoOcupacion} />
                      </td>
                    </tr>

                    {/* ExpansiÃ³n: tabla de perÃ­odos */}
                    {expandedId === tenant.id && periods.length > 0 ? (
                      <tr key={`${tenant.id}-periodos`} className="bg-slate-50/40">
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
                                const partKey = `${tenant.id}::${period}`;
                                const isOpen = partidaAbierta === partKey;
                                const isLoading = loadingPartida.has(partKey);
                                const partidas = partidaCache.get(partKey);

                                return (
                                  <Fragment key={period}>
                                    <tr
                                      className={`cursor-pointer border-b border-slate-50 ${billed > 0 ? "hover:bg-brand-700/5" : ""}`}
                                      onClick={() => {
                                        if (billed > 0) void togglePartida(tenant.id, period);
                                      }}
                                    >
                                      <td className="py-1.5 text-slate-600">
                                        {billed > 0 && (
                                          <span className="mr-1.5 text-slate-300">
                                            {isLoading ? "â³" : isOpen ? "â–¼" : "â–¶"}
                                          </span>
                                        )}
                                        {period}
                                      </td>
                                      <td className="py-1.5 text-right font-medium text-slate-700">
                                        {billed > 0 ? formatUf(billed) : "â€”"}
                                      </td>
                                      <td className="py-1.5 text-right text-slate-600">
                                        {sales > 0 ? formatUf(sales) : "â€”"}
                                      </td>
                                      <td className="py-1.5 text-center">
                                        <OccupancyBadge pct={occupancy} />
                                      </td>
                                    </tr>

                                    {/* Detalle de partidas del perÃ­odo */}
                                    {isOpen && partidas && partidas.length > 0 && (
                                      <tr>
                                        <td colSpan={4} className="pb-2 pt-0">
                                          <table className="w-full border-l-2 border-brand-700/20 bg-white text-xs">
                                            <thead>
                                              <tr className="border-b border-slate-100 bg-slate-50/60">
                                                <th className="px-3 py-1 text-left font-medium text-slate-400">Grupo</th>
                                                <th className="px-3 py-1 text-left font-medium text-slate-400">Partida</th>
                                                <th className="px-3 py-1 text-left font-medium text-slate-400">DenominaciÃ³n</th>
                                                <th className="px-3 py-1 text-right font-medium text-slate-400">UF</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {partidas.map((p, i) => (
                                                <tr key={i} className="border-b border-slate-50">
                                                  <td className="px-3 py-1 text-slate-400">{p.grupo1}</td>
                                                  <td className="px-3 py-1 text-slate-500">{p.grupo3}</td>
                                                  <td className="px-3 py-1 text-slate-500">{p.denominacion}</td>
                                                  <td className="px-3 py-1 text-right font-medium text-slate-700">
                                                    {formatUf(p.valorUf)}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
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




