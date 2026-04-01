"use client";

import { useState, useEffect, useCallback } from "react";
import { formatUf } from "@/lib/utils";
import { ProjectSelector } from "@/components/ui/ProjectSelector";

type Project = { id: string; nombre: string; slug: string };

type ArrendatarioData = {
  id: string;
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  locales: { id: string; codigo: string; nombre: string }[];
  periodos: string[];
  facturacionPorPeriodo: Record<string, number>;
  ventasPorPeriodo: Record<string, number>;
  totalFacturado: number;
  totalVentas: number;
  costoOcupacion: number | null;
};

function SemaforoOcupacion({ pct }: { pct: number | null }): JSX.Element {
  if (pct === null) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">Sin ventas</span>;
  }
  const color =
    pct < 10
      ? "bg-emerald-100 text-emerald-700"
      : pct < 15
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {formatUf(pct, 1)}%
    </span>
  );
}

export function ArrendatariosFinanzasClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: {
  projects: Project[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
}): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<ArrendatarioData[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId });
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`/api/finanzas/arrendatario?${params}`);
      const json = await res.json();
      setData(json.arrendatarios ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const periodos = data.length > 0
    ? [...new Set(data.flatMap((a) => a.periodos))].sort()
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Facturación por Arrendatario</h2>
          <p className="text-sm text-slate-500">
            Costo de ocupación = Facturación total / Ventas. Verde &lt;10%, Amarillo 10-15%, Rojo &gt;15%.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} />
          <div className="flex items-center gap-2 text-sm">
            <label className="font-medium text-slate-600">Desde</label>
            <input
              type="month"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <label className="font-medium text-slate-600">Hasta</label>
            <input
              type="month"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-md bg-white shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">Cargando...</div>
        ) : data.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <p>Sin datos para el periodo seleccionado.</p>
            <a href={`/finanzas/upload?proyecto=${selectedProjectId}`} className="text-brand-500 underline">
              Cargar datos contables →
            </a>
          </div>
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
                    Facturación Total UF
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ventas UF
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Costo Ocupación
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((arr) => (
                  <>
                    <tr
                      key={arr.id}
                      className="cursor-pointer hover:bg-slate-50/60"
                      onClick={() => setExpandido(expandido === arr.id ? null : arr.id)}
                    >
                      <td className="sticky left-0 bg-white px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">{expandido === arr.id ? "▼" : "▶"}</span>
                          {arr.nombreComercial}
                        </div>
                        <p className="text-xs text-slate-400">{arr.rut}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {arr.locales.map((l) => l.codigo).join(", ")}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">
                        {formatUf(arr.totalFacturado)} UF
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">
                        {arr.totalVentas > 0 ? `${formatUf(arr.totalVentas)} UF` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <SemaforoOcupacion pct={arr.costoOcupacion} />
                      </td>
                    </tr>

                    {/* Detalle por mes */}
                    {expandido === arr.id && periodos.length > 0 && (
                      <tr key={`${arr.id}-detalle`} className="bg-slate-50/40">
                        <td colSpan={5} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="pb-1 text-left font-semibold text-slate-500">Periodo</th>
                                <th className="pb-1 text-right font-semibold text-slate-500">Facturación UF</th>
                                <th className="pb-1 text-right font-semibold text-slate-500">Ventas UF</th>
                                <th className="pb-1 text-center font-semibold text-slate-500">Costo Ocup.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {periodos.map((p) => {
                                const fact = arr.facturacionPorPeriodo[p] ?? 0;
                                const venta = arr.ventasPorPeriodo[p] ?? 0;
                                const co = venta > 0 ? (fact / venta) * 100 : null;
                                return (
                                  <tr key={p} className="border-b border-slate-50">
                                    <td className="py-1 text-slate-600">{p}</td>
                                    <td className="py-1 text-right text-slate-700">{fact > 0 ? formatUf(fact) : "—"}</td>
                                    <td className="py-1 text-right text-slate-600">{venta > 0 ? formatUf(venta) : "—"}</td>
                                    <td className="py-1 text-center">
                                      <SemaforoOcupacion pct={co} />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
