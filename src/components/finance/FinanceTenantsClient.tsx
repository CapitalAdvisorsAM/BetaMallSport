"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { OccupancyBadge } from "@/components/finance/OccupancyBadge";
import { TableDisclosureButton } from "@/components/ui/TableDisclosureButton";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import { getGapSeverity } from "@/lib/shared/gap-utils";
import { useRouter } from "next/navigation";
import type { ArrendatarioPartidaDetalle, ProjectOption, TenantFinanceRow } from "@/types/finance";
import { formatUf, cn } from "@/lib/utils";

type GapFilter = "all" | "over5" | "over10" | "overbilled";

const gapTextColor: Record<ReturnType<typeof getGapSeverity>, string> = {
  ok: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700 font-semibold"
};

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
  const router = useRouter();
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<TenantFinanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gapFilter, setGapFilter] = useState<GapFilter>("all");

  // Detalle por partida: clave "tenantId::periodo"
  const [partidaAbierta, setPartidaAbierta] = useState<string | null>(null);
  const [partidaCache, setPartidaCache] = useState<Map<string, ArrendatarioPartidaDetalle[]>>(new Map());
  const [loadingPartida, setLoadingPartida] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
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

  const hasGapData = data.some((t) => t.totalEsperado !== null);

  const filteredData = useMemo(() => {
    if (gapFilter === "all") return data;
    return data.filter((t) => {
      if (t.brechaPct === null) return false;
      switch (gapFilter) {
        case "over5": return Math.abs(t.brechaPct) >= 5;
        case "over10": return Math.abs(t.brechaPct) >= 10;
        case "overbilled": return t.brechaUf !== null && t.brechaUf < 0;
        default: return true;
      }
    });
  }, [data, gapFilter]);

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
      const params = new URLSearchParams({ projectId: selectedProjectId, arrendatarioId: tenantId, periodo });
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
          <div className="flex flex-wrap items-end gap-3">
            <ProjectPeriodToolbar
              desde={desde}
              hasta={hasta}
              onDesdeChange={setDesde}
              onHastaChange={setHasta}
            />
            {hasGapData && (
              <select
                value={gapFilter}
                onChange={(e) => setGapFilter(e.target.value as GapFilter)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
              >
                <option value="all">Todas las brechas</option>
                <option value="over5">Brecha &gt;5%</option>
                <option value="over10">Brecha &gt;10%</option>
                <option value="overbilled">Sobre-facturado</option>
              </select>
            )}
          </div>
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
            <table className={tableTheme.table}>
              <thead className={tableTheme.head}>
                <tr>
                  <th className={`${tableTheme.headCell} sticky left-0 bg-brand-700`}>
                    Arrendatario
                  </th>
                  <th className={tableTheme.compactHeadCell}>
                    Locales
                  </th>
                  <th className={`${tableTheme.compactHeadCell} text-right`}>
                    Facturacion Total (UF)
                  </th>
                  <th className={`${tableTheme.compactHeadCell} text-right`}>
                    Ventas (UF)
                  </th>
                  <th className={`${tableTheme.compactHeadCell} text-center`}>
                    Costo Ocupacion
                  </th>
                  {hasGapData && (
                    <>
                      <th className={`${tableTheme.compactHeadCell} text-right`}>
                        Esperado (UF)
                      </th>
                      <th className={`${tableTheme.compactHeadCell} text-right`}>
                        Brecha (UF)
                      </th>
                      <th className={`${tableTheme.compactHeadCell} text-right`}>
                        Brecha %
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((tenant, index) => (
                  <Fragment key={tenant.id}>
                    {/* Fila principal del arrendatario */}
                    <tr className={`${getStripedRowClass(index)} ${tableTheme.rowHover}`}>
                      <td className="sticky left-0 bg-inherit px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <TableDisclosureButton
                            expanded={expandedId === tenant.id}
                            label={`${expandedId === tenant.id ? "Contraer" : "Expandir"} ${tenant.nombreComercial}`}
                            onToggle={() => setExpandedId(expandedId === tenant.id ? null : tenant.id)}
                          />
                          <Link
                            href={`/tenants/${tenant.id}?project=${selectedProjectId}`}
                            className="text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
                          >
                            {tenant.nombreComercial}
                          </Link>
                        </div>
                        <p className="text-xs text-slate-400">{tenant.rut}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {tenant.locales.map((local, i) => (
                          <span
                            key={local.id}
                            onClick={() => router.push(`/rent-roll/units?project=${selectedProjectId}&detalle=${local.id}`)}
                            className={cn(
                              "cursor-pointer text-brand-500 hover:text-brand-700 underline underline-offset-2 font-medium transition-colors",
                              i > 0 && "ml-1"
                            )}
                          >
                            {local.codigo}
                          </span>
                        )) || ""}
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
                      {hasGapData && (
                        <>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                            {tenant.totalEsperado !== null ? `${formatUf(tenant.totalEsperado)} UF` : "–"}
                          </td>
                          <td className={cn(
                            "px-3 py-3 text-right tabular-nums",
                            tenant.brechaPct !== null ? gapTextColor[getGapSeverity(tenant.brechaPct)] : "text-slate-400"
                          )}>
                            {tenant.brechaUf !== null ? `${formatUf(tenant.brechaUf)} UF` : "–"}
                          </td>
                          <td className={cn(
                            "px-3 py-3 text-right tabular-nums",
                            tenant.brechaPct !== null ? gapTextColor[getGapSeverity(tenant.brechaPct)] : "text-slate-400"
                          )}>
                            {tenant.brechaPct !== null ? `${formatUf(tenant.brechaPct, 1)}%` : "–"}
                          </td>
                        </>
                      )}
                    </tr>

                    {/* Expansión: tabla de períodos */}
                    {expandedId === tenant.id && periods.length > 0 ? (
                      <tr key={`${tenant.id}-periodos`} className="bg-slate-50/40">
                        <td colSpan={hasGapData ? 8 : 5} className="px-4 py-3">
                          <table className={`${tableTheme.table} text-xs`}>
                            <thead className={tableTheme.head}>
                              <tr>
                                <th className={tableTheme.compactHeadCell}>Periodo</th>
                                <th className={`${tableTheme.compactHeadCell} text-right`}>Facturacion (UF)</th>
                                <th className={`${tableTheme.compactHeadCell} text-right`}>Ventas (UF)</th>
                                <th className={`${tableTheme.compactHeadCell} text-center`}>Costo Ocup.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
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
                                    <tr className={billed > 0 ? tableTheme.rowHover : ""}>
                                      <td className="py-1.5 text-slate-600">
                                        <div className="flex items-center gap-1.5">
                                          {billed > 0 ? (
                                            <TableDisclosureButton
                                              expanded={isOpen}
                                              loading={isLoading}
                                              label={`${isOpen ? "Contraer" : "Expandir"} partidas ${period}`}
                                              onToggle={() => {
                                                void togglePartida(tenant.id, period);
                                              }}
                                              className="h-5 w-5"
                                            />
                                          ) : null}
                                          <span>{period}</span>
                                        </div>
                                      </td>
                                      <td className="py-1.5 text-right font-medium tabular-nums text-slate-700">
                                        {billed > 0 ? formatUf(billed) : "—"}
                                      </td>
                                      <td className="py-1.5 text-right tabular-nums text-slate-600">
                                        {sales > 0 ? formatUf(sales) : "—"}
                                      </td>
                                      <td className="py-1.5 text-center">
                                        <OccupancyBadge pct={occupancy} />
                                      </td>
                                    </tr>

                                    {/* Detalle de partidas del período */}
                                    {isOpen && partidas && partidas.length > 0 && (
                                      <tr>
                                        <td colSpan={4} className="pb-2 pt-0">
                                          <table className={`${tableTheme.table} border-l-2 border-brand-700/20 bg-white text-xs`}>
                                            <thead className={tableTheme.head}>
                                              <tr>
                                                <th className={tableTheme.compactHeadCell}>Grupo</th>
                                                <th className={tableTheme.compactHeadCell}>Partida</th>
                                                <th className={tableTheme.compactHeadCell}>Denominación</th>
                                                <th className={`${tableTheme.compactHeadCell} text-right`}>UF</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
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




