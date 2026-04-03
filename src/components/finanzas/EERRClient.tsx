"use client";

import { useState, useEffect, useCallback } from "react";
import { formatUf } from "@/lib/utils";
import { ProjectSelector } from "@/components/ui/ProjectSelector";

type Project = { id: string; nombre: string; slug: string };

type Linea = {
  grupo3: string;
  tipo: "ingreso" | "costo";
  porPeriodo: Record<string, number>;
  total: number;
};

type Seccion = {
  grupo1: string;
  tipo: "ingreso" | "costo";
  lineas: Linea[];
  porPeriodo: Record<string, number>;
  total: number;
};

type EERRData = {
  periodos: string[];
  secciones: Seccion[];
  ebitda: { porPeriodo: Record<string, number>; total: number };
};

function getSemaforo(tipo: "ingreso" | "costo", valor: number): string {
  if (valor === 0) return "text-slate-400";
  if (tipo === "ingreso") return valor > 0 ? "text-emerald-700" : "text-red-600";
  return valor < 0 ? "text-red-600" : "text-slate-700";
}

export function EERRClient({
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
  const [data, setData] = useState<EERRData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId });
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`/api/finanzas/eerr?${params}`);
      const json = await res.json();
      setData(json);
      // Expand all sections by default
      setExpandidos(new Set(json.secciones?.map((s: Seccion) => s.grupo1) ?? []));
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function toggleSeccion(grupo1: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(grupo1)) next.delete(grupo1);
      else next.add(grupo1);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Estado de Resultados</h2>
          <p className="text-sm text-slate-500">EE.RR consolidado del proyecto por periodo</p>
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

      {/* Table */}
      <div className="rounded-md bg-white shadow-sm">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">
            Cargando EE.RR...
          </div>
        ) : !data || data.secciones.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <p>Sin datos contables para el periodo seleccionado.</p>
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
                    Cuenta
                  </th>
                  {data.periodos.map((p) => (
                    <th key={p} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {p.slice(0, 7)}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.secciones.map((sec) => (
                  <>
                    {/* Fila de sección */}
                    <tr
                      key={sec.grupo1}
                      className="cursor-pointer border-b border-slate-100 bg-slate-50/80 hover:bg-slate-100"
                      onClick={() => toggleSeccion(sec.grupo1)}
                    >
                      <td className="sticky left-0 bg-inherit px-4 py-2.5 font-semibold text-slate-800">
                        <span className="mr-2 text-slate-400">{expandidos.has(sec.grupo1) ? "▼" : "▶"}</span>
                        {sec.grupo1}
                      </td>
                      {data.periodos.map((p) => (
                        <td key={p} className={`px-3 py-2.5 text-right font-semibold ${getSemaforo(sec.tipo, sec.porPeriodo[p] ?? 0)}`}>
                          {sec.porPeriodo[p] !== undefined ? formatUf(sec.porPeriodo[p]) : "—"}
                        </td>
                      ))}
                      <td className={`px-3 py-2.5 text-right font-bold ${getSemaforo(sec.tipo, sec.total)}`}>
                        {formatUf(sec.total)}
                      </td>
                    </tr>
                    {/* Líneas de detalle */}
                    {expandidos.has(sec.grupo1) &&
                      sec.lineas.map((linea) => (
                        <tr key={`${sec.grupo1}-${linea.grupo3}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="sticky left-0 bg-white py-2 pl-10 pr-4 text-slate-600">
                            {linea.grupo3}
                          </td>
                          {data.periodos.map((p) => (
                            <td key={p} className={`px-3 py-2 text-right ${getSemaforo(linea.tipo, linea.porPeriodo[p] ?? 0)}`}>
                              {linea.porPeriodo[p] !== undefined ? formatUf(linea.porPeriodo[p]) : "—"}
                            </td>
                          ))}
                          <td className={`px-3 py-2 text-right font-medium ${getSemaforo(linea.tipo, linea.total)}`}>
                            {formatUf(linea.total)}
                          </td>
                        </tr>
                      ))}
                  </>
                ))}

                {/* EBITDA */}
                <tr className="border-t-2 border-slate-300 bg-brand-700/5">
                  <td className="sticky left-0 bg-inherit px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-800">
                    EBITDA
                  </td>
                  {data.periodos.map((p) => {
                    const v = data.ebitda.porPeriodo[p] ?? 0;
                    return (
                      <td key={p} className={`px-3 py-3 text-right text-sm font-bold ${v >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {formatUf(v)}
                      </td>
                    );
                  })}
                  <td className={`px-3 py-3 text-right text-sm font-bold ${data.ebitda.total >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {formatUf(data.ebitda.total)}
                  </td>
                </tr>

                {/* Margen EBITDA */}
                {data.secciones.some((s) => s.tipo === "ingreso") && (() => {
                  const ingresosSec = data.secciones.filter((s) => s.tipo === "ingreso");
                  return (
                    <tr className="bg-brand-700/5">
                      <td className="sticky left-0 bg-inherit px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Mg EBITDA (%)
                      </td>
                      {data.periodos.map((p) => {
                        const ing = ingresosSec.reduce((a, s) => a + (s.porPeriodo[p] ?? 0), 0);
                        const ebitda = data.ebitda.porPeriodo[p] ?? 0;
                        const mg = ing !== 0 ? (ebitda / ing) * 100 : null;
                        return (
                          <td key={p} className={`px-3 py-2 text-right text-xs font-semibold ${mg !== null && mg >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {mg !== null ? `${formatUf(mg, 1)}%` : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right text-xs font-semibold text-slate-500">—</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
