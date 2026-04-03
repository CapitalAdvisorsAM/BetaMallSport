"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { BELOW_EBITDA_GROUPS, calculateEbitdaMargin, formatEerr } from "@/lib/finanzas/eerr";
import type { EerrData, EerrDetalleResponse, ProjectOption } from "@/types/finanzas";

type EERRClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

type ModoVista = "mensual" | "anual";

function aggregateByYear(data: EerrData): EerrData {
  const years = [...new Set(data.periodos.map((p) => p.slice(0, 4)))].sort();
  const agg = (record: Record<string, number>) =>
    Object.fromEntries(years.map((y) => [y, Object.entries(record).filter(([k]) => k.startsWith(y)).reduce((s, [, v]) => s + v, 0)]));

  return {
    periodos: years,
    secciones: data.secciones.map((s) => ({
      ...s,
      porPeriodo: agg(s.porPeriodo),
      lineas: s.lineas.map((l) => ({ ...l, porPeriodo: agg(l.porPeriodo) }))
    })),
    ebitda: { total: data.ebitda.total, porPeriodo: agg(data.ebitda.porPeriodo) },
    ebit:   { total: data.ebit.total,   porPeriodo: agg(data.ebit.porPeriodo) }
  };
}

/** Clase CSS para valor del EE.RR — negro para positivos, rojo para negativos */
function valueCls(v: number): string {
  if (v === 0) return "text-slate-300";
  return v < 0 ? "text-red-600" : "text-slate-800";
}

/** Clase para EBITDA / EBIT */
function ebitdaCls(v: number): string {
  if (v === 0) return "text-slate-400";
  return v >= 0 ? "text-emerald-700 font-bold" : "text-red-600 font-bold";
}

export function EERRClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: EERRClientProps): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [modo, setModo] = useState<ModoVista>("mensual");
  const [rawData, setRawData] = useState<EerrData | null>(null);
  const [loading, setLoading] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [detalleCache, setDetalleCache] = useState<Map<string, EerrDetalleResponse>>(new Map());
  const [loadingLines, setLoadingLines] = useState<Set<string>>(new Set());

  const data = rawData && modo === "anual" ? aggregateByYear(rawData) : rawData;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId });
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`/api/finanzas/eerr?${params}`);
      const payload = (await res.json()) as EerrData;
      setRawData(payload);
      setExpandedSections(new Set(payload.secciones?.map((s) => s.grupo1) ?? []));
      setExpandedLines(new Set());
      setExpandedCats(new Set());
      setDetalleCache(new Map());
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function toggleSection(g1: string) {
    setExpandedSections((p) => { const n = new Set(p); n.has(g1) ? n.delete(g1) : n.add(g1); return n; });
  }

  async function toggleLine(g1: string, g3: string) {
    const key = `${g1}::${g3}`;
    setExpandedLines((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
    if (detalleCache.has(key)) return;
    setLoadingLines((p) => new Set(p).add(key));
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId, grupo1: g1, grupo3: g3 });
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`/api/finanzas/eerr/detalle?${params}`);
      const d = (await res.json()) as EerrDetalleResponse;
      setDetalleCache((p) => new Map(p).set(key, d));
    } finally {
      setLoadingLines((p) => { const n = new Set(p); n.delete(key); return n; });
    }
  }

  function toggleCat(g1: string, g3: string, cat: string) {
    const key = `${g1}::${g3}::${cat}`;
    setExpandedCats((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  if (!data && !loading) return <></>;

  const ingresos = data?.secciones.find((s) => s.grupo1 === "INGRESOS DE EXPLOTACION");
  const aboveEbitdaSections = data?.secciones.filter((s) => !BELOW_EBITDA_GROUPS.has(s.grupo1)) ?? [];
  const belowEbitdaSections = data?.secciones.filter((s) => BELOW_EBITDA_GROUPS.has(s.grupo1)) ?? [];

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="EE.RR (UF)"
        description="Estado de resultados consolidado del proyecto por periodo."
        projects={projects}
        selectedProjectId={selectedProjectId}
        preserve={{ desde, hasta }}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded border border-slate-200 text-xs font-medium">
              <button onClick={() => setModo("mensual")} className={`px-3 py-1.5 ${modo === "mensual" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Mensual</button>
              <button onClick={() => setModo("anual")} className={`px-3 py-1.5 ${modo === "anual" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>Anual</button>
            </div>
            <ProjectPeriodToolbar desde={desde} hasta={hasta} onDesdeChange={setDesde} onHastaChange={setHasta} />
          </div>
        }
      />

      <ModuleSectionCard>
        {loading ? (
          <ModuleLoadingState message="Cargando EE.RR..." />
        ) : !data || data.secciones.length === 0 ? (
          <ModuleEmptyState message="Sin datos contables para el periodo seleccionado." actionHref={`/finanzas/upload?proyecto=${selectedProjectId}`} actionLabel="Cargar datos contables" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              {/* Header */}
              <thead>
                <tr className="border-b-2 border-slate-700 bg-slate-800 text-white">
                  <th className="sticky left-0 bg-slate-800 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide w-56">
                    EE.RR (UF)
                  </th>
                  {data.periodos.map((p) => (
                    <th key={p} className="min-w-[80px] px-2 py-2 text-right text-xs font-semibold">
                      {p}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right text-xs font-bold text-slate-300">Total</th>
                </tr>
              </thead>

              <tbody>
                {/* Secciones SOBRE el EBITDA */}
                {aboveEbitdaSections.map((section) => {
                  const isExpanded = expandedSections.has(section.grupo1);
                  const isCost = section.tipo === "costo";
                  return (
                    <Fragment key={section.grupo1}>
                      {/* Fila GRUPO 1 */}
                      <tr
                        className={`cursor-pointer border-b border-slate-200 ${isCost ? "bg-slate-100/70" : "bg-slate-50"} hover:bg-slate-100`}
                        onClick={() => toggleSection(section.grupo1)}
                      >
                        <td className="sticky left-0 bg-inherit px-4 py-2 font-semibold text-slate-800">
                          <span className="mr-1.5 text-slate-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
                          {section.grupo1}
                        </td>
                        {data.periodos.map((p) => (
                          <td key={p} className={`px-2 py-2 text-right font-semibold ${valueCls(section.porPeriodo[p] ?? 0)}`}>
                            {formatEerr(section.porPeriodo[p] ?? 0)}
                          </td>
                        ))}
                        <td className={`px-2 py-2 text-right font-bold ${valueCls(section.total)}`}>
                          {formatEerr(section.total)}
                        </td>
                      </tr>

                      {/* Filas GRUPO 3 */}
                      {isExpanded && section.lineas.map((line) => {
                        const lineKey = `${section.grupo1}::${line.grupo3}`;
                        const isLineExpanded = expandedLines.has(lineKey);
                        const isLineLoading = loadingLines.has(lineKey);
                        const detalle = detalleCache.get(lineKey);

                        return (
                          <Fragment key={lineKey}>
                            <tr
                              className="cursor-pointer border-b border-slate-100 bg-white hover:bg-slate-50/60"
                              onClick={() => void toggleLine(section.grupo1, line.grupo3)}
                            >
                              <td className="sticky left-0 bg-white py-1.5 pl-9 pr-4 text-slate-600">
                                <span className="mr-1 text-slate-300">{isLineLoading ? "⏳" : isLineExpanded ? "▼" : "▶"}</span>
                                {line.grupo3}
                              </td>
                              {data.periodos.map((p) => (
                                <td key={p} className={`px-2 py-1.5 text-right ${valueCls(line.porPeriodo[p] ?? 0)}`}>
                                  {formatEerr(line.porPeriodo[p] ?? 0)}
                                </td>
                              ))}
                              <td className={`px-2 py-1.5 text-right font-medium ${valueCls(line.total)}`}>
                                {formatEerr(line.total)}
                              </td>
                            </tr>

                            {/* Nivel 3: Categoría */}
                            {isLineExpanded && detalle?.categorias.map((cat) => {
                              const catKey = `${section.grupo1}::${line.grupo3}::${cat.categoriaTipo}`;
                              const isCatExpanded = expandedCats.has(catKey);
                              return (
                                <Fragment key={catKey}>
                                  <tr
                                    className="cursor-pointer border-b border-slate-50/70 bg-slate-50/20 hover:bg-slate-50"
                                    onClick={() => toggleCat(section.grupo1, line.grupo3, cat.categoriaTipo)}
                                  >
                                    <td className="sticky left-0 bg-inherit py-1 pl-14 pr-4 text-slate-400">
                                      <span className="mr-1 text-slate-200">{isCatExpanded ? "▼" : "▶"}</span>
                                      {cat.categoriaTipo}
                                    </td>
                                    {data.periodos.map((p) => (
                                      <td key={p} className={`px-2 py-1 text-right text-slate-400`}>
                                        {formatEerr(cat.porPeriodo[p] ?? 0)}
                                      </td>
                                    ))}
                                    <td className="px-2 py-1 text-right text-slate-500">{formatEerr(cat.total)}</td>
                                  </tr>

                                  {/* Nivel 4: Local / Arrendatario */}
                                  {isCatExpanded && cat.locales.map((loc) => (
                                    <tr key={loc.localId} className="border-b border-slate-50/30 bg-white hover:bg-slate-50/10">
                                      <td className="sticky left-0 bg-inherit py-0.5 pl-20 pr-4 text-slate-300">
                                        <span className="font-mono text-slate-200">[{loc.localCodigo}]</span>
                                        <span className="ml-1.5 text-slate-400">{loc.arrendatarioNombre ?? loc.localNombre}</span>
                                      </td>
                                      {data.periodos.map((p) => (
                                        <td key={p} className="px-2 py-0.5 text-right text-slate-400">
                                          {formatEerr(loc.porPeriodo[p] ?? 0)}
                                        </td>
                                      ))}
                                      <td className="px-2 py-0.5 text-right text-slate-400">{formatEerr(loc.total)}</td>
                                    </tr>
                                  ))}
                                </Fragment>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}

                {/* EBITDA */}
                <tr className="border-y-2 border-slate-700 bg-slate-800 text-white">
                  <td className="sticky left-0 bg-slate-800 px-4 py-2.5 text-sm font-bold uppercase tracking-wide">EBITDA</td>
                  {data.periodos.map((p) => {
                    const v = data.ebitda.porPeriodo[p] ?? 0;
                    return (
                      <td key={p} className={`px-2 py-2.5 text-right text-sm font-bold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatEerr(v)}
                      </td>
                    );
                  })}
                  <td className={`px-2 py-2.5 text-right text-sm font-bold ${data.ebitda.total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatEerr(data.ebitda.total)}
                  </td>
                </tr>

                {/* Mg EBITDA */}
                {ingresos && (
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <td className="sticky left-0 bg-inherit px-4 py-1.5 text-slate-500 font-medium">Mg EBITDA (%)</td>
                    {data.periodos.map((p) => {
                      const ing = ingresos.porPeriodo[p] ?? 0;
                      const mg = calculateEbitdaMargin(ing, data.ebitda.porPeriodo[p] ?? 0);
                      return (
                        <td key={p} className={`px-2 py-1.5 text-right font-semibold ${mg !== null && mg >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {mg !== null ? `${mg.toFixed(1)}%` : "—"}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right text-slate-400">—</td>
                  </tr>
                )}

                {/* Secciones BAJO el EBITDA (Depreciación, etc.) */}
                {belowEbitdaSections.map((section) => {
                  const isExpanded = expandedSections.has(section.grupo1);
                  return (
                    <Fragment key={section.grupo1}>
                      <tr
                        className="cursor-pointer border-b border-slate-100 bg-slate-50/60 hover:bg-slate-100"
                        onClick={() => toggleSection(section.grupo1)}
                      >
                        <td className="sticky left-0 bg-inherit px-4 py-1.5 font-medium text-slate-700">
                          <span className="mr-1.5 text-slate-300 text-xs">{isExpanded ? "▼" : "▶"}</span>
                          {section.grupo1}
                        </td>
                        {data.periodos.map((p) => (
                          <td key={p} className={`px-2 py-1.5 text-right ${valueCls(section.porPeriodo[p] ?? 0)}`}>
                            {formatEerr(section.porPeriodo[p] ?? 0)}
                          </td>
                        ))}
                        <td className={`px-2 py-1.5 text-right font-medium ${valueCls(section.total)}`}>
                          {formatEerr(section.total)}
                        </td>
                      </tr>
                      {isExpanded && section.lineas.map((line) => (
                        <tr key={line.grupo3} className="border-b border-slate-50 bg-white">
                          <td className="sticky left-0 bg-white py-1 pl-9 pr-4 text-slate-500">{line.grupo3}</td>
                          {data.periodos.map((p) => (
                            <td key={p} className={`px-2 py-1 text-right ${valueCls(line.porPeriodo[p] ?? 0)}`}>
                              {formatEerr(line.porPeriodo[p] ?? 0)}
                            </td>
                          ))}
                          <td className={`px-2 py-1 text-right ${valueCls(line.total)}`}>{formatEerr(line.total)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}

                {/* EBIT */}
                {belowEbitdaSections.length > 0 && (
                  <tr className="border-t-2 border-slate-700 bg-slate-800 text-white">
                    <td className="sticky left-0 bg-slate-800 px-4 py-2.5 text-sm font-bold uppercase tracking-wide">EBIT</td>
                    {data.periodos.map((p) => {
                      const v = data.ebit.porPeriodo[p] ?? 0;
                      return (
                        <td key={p} className={`px-2 py-2.5 text-right text-sm font-bold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {formatEerr(v)}
                        </td>
                      );
                    })}
                    <td className={`px-2 py-2.5 text-right text-sm font-bold ${data.ebit.total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatEerr(data.ebit.total)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>
    </main>
  );
}
