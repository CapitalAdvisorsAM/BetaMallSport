"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { BELOW_EBITDA_GROUPS, calculateEbitdaMargin, formatEerr } from "@/lib/finance/eerr";
import type { EerrData, EerrDetalleResponse, ProjectOption } from "@/types/finance";

type BillingLine = { grupo1: string; grupo3: string; porPeriodo: Record<string, number>; total: number };
type BillingResponse = { periodos: string[]; lineas: BillingLine[]; total: number };
type ArrendatarioPanel = { arrendatarioId: string; nombre: string; localCodigo: string };

type EerrClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

type ModoVista = "mensual" | "anual";

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** "2025-01" -> "Ene 25" */
function formatPeriodo(p: string): string {
  const [year, month] = p.split("-");
  if (!year || !month) return p;
  if (p.length === 4) return year;
  return `${MESES_ES[parseInt(month, 10) - 1] ?? month} ${year.slice(2)}`;
}

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

/** All numbers dark - parentheses from formatEerr handle negatives, no traffic lights */
function numCls(bold = false): string {
  return bold ? "text-slate-900 font-semibold" : "text-slate-700";
}

const CREDIT_LINES = new Set(["RECUPERACION GASTOS COMUNES", "FONDO DE PROMOCION"]);

const TriangleIcon = ({ open }: { open: boolean }) => (
  <span className={`inline-block w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-slate-400 transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />
);

const Spinner = () => (
  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500 shrink-0" />
);

export function EerrClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: EerrClientProps): JSX.Element {
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

  const [arrendatarioPanel, setArrendatarioPanel] = useState<ArrendatarioPanel | null>(null);
  const [billingData, setBillingData] = useState<BillingResponse | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const billingCacheRef = useRef<Map<string, BillingResponse>>(new Map());

  const data = rawData && modo === "anual" ? aggregateByYear(rawData) : rawData;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/finance/eerr?${params}`);
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
    setExpandedSections((previous) => {
      const next = new Set(previous);
      if (next.has(g1)) {
        next.delete(g1);
      } else {
        next.add(g1);
      }
      return next;
    });
  }

  async function toggleLine(g1: string, g3: string) {
    const key = `${g1}::${g3}`;
    setExpandedLines((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    if (detalleCache.has(key)) return;
    setLoadingLines((p) => new Set(p).add(key));
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId, grupo1: g1, grupo3: g3 });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/finance/eerr/detalle?${params}`);
      const d = (await res.json()) as EerrDetalleResponse;
      setDetalleCache((p) => new Map(p).set(key, d));
    } finally {
      setLoadingLines((p) => { const n = new Set(p); n.delete(key); return n; });
    }
  }

  function toggleCat(g1: string, g3: string, cat: string) {
    const key = `${g1}::${g3}::${cat}`;
    setExpandedCats((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function openArrendatarioPanel(panel: ArrendatarioPanel) {
    setArrendatarioPanel(panel);
    const cacheKey = `${panel.arrendatarioId}::${desde}::${hasta}`;
    if (billingCacheRef.current.has(cacheKey)) {
      setBillingData(billingCacheRef.current.get(cacheKey)!);
      return;
    }
    setLoadingBilling(true);
    setBillingData(null);
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId, arrendatarioId: panel.arrendatarioId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/finance/tenants/detail?${params}`);
      const d = (await res.json()) as BillingResponse;
      billingCacheRef.current.set(cacheKey, d);
      setBillingData(d);
    } finally {
      setLoadingBilling(false);
    }
  }

  if (!data && !loading) return <></>;

  const ingresos = data?.secciones.find((s) => s.grupo1 === "INGRESOS DE EXPLOTACION");
  const aboveEbitdaSections = data?.secciones.filter((s) => !BELOW_EBITDA_GROUPS.has(s.grupo1)) ?? [];
  const belowEbitdaSections = data?.secciones.filter((s) => BELOW_EBITDA_GROUPS.has(s.grupo1)) ?? [];

  return (

    <main className="space-y-4">
      <ModuleHeader
        title="Estado de Resultados (UF)"
        description="Resultado consolidado del proyecto por periodo."
        projects={projects}
        selectedProjectId={selectedProjectId}
        showProjectSelector={false}
        preserve={{ desde, hasta }}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex overflow-hidden rounded border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setModo("mensual")}
                className={`px-3 py-1.5 ${modo === "mensual" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Mensual
              </button>
              <button
                onClick={() => setModo("anual")}
                className={`px-3 py-1.5 ${modo === "anual" ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Anual
              </button>
            </div>
            <ProjectPeriodToolbar desde={desde} hasta={hasta} onDesdeChange={setDesde} onHastaChange={setHasta} />
          </div>
        }
      />

      <ModuleSectionCard>
        {loading ? (
          <ModuleLoadingState message="Cargando Estado de Resultados..." />
        ) : !data || data.secciones.length === 0 ? (
          <ModuleEmptyState
            message="Sin datos contables para el periodo seleccionado."
            actionHref={`/finance/upload?project=${selectedProjectId}`}
            actionLabel="Cargar datos contables"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-sans text-[11px]">

              {/* Header */}
              <thead className="sticky top-0 z-20">
                <tr className="border-b-2 border-slate-400 bg-slate-50">
                  <th className="sticky left-0 bg-slate-50 w-72 py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    En UF
                  </th>
                  {data.periodos.map((p) => (
                    <th key={p} className="min-w-[90px] px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      {formatPeriodo(p)}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide text-slate-700">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* Secciones sobre EBITDA */}
                {aboveEbitdaSections.map((section, sIdx) => {
                  const isExpanded = expandedSections.has(section.grupo1);
                  return (
                    <Fragment key={section.grupo1}>
                      {/* Subtle spacer between sections */}
                      {sIdx > 0 && <tr><td colSpan={data.periodos.length + 2} className="h-1 bg-slate-50" /></tr>}

                      {/* Grupo1 header row */}
                      <tr
                        className="cursor-pointer border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                        onClick={() => toggleSection(section.grupo1)}
                      >
                        <td className="sticky left-0 bg-white py-2.5 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            <TriangleIcon open={isExpanded} />
                            <span className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">
                              {section.grupo1}
                            </span>
                          </div>
                        </td>
                        {data.periodos.map((p) => (
                          <td key={p} className={`px-3 py-2.5 text-right tabular-nums ${numCls(true)}`}>
                            {formatEerr(section.porPeriodo[p] ?? 0)}
                          </td>
                        ))}
                        <td className={`px-3 py-2.5 text-right tabular-nums border-l border-slate-200 ${numCls(true)}`}>
                          {formatEerr(section.total)}
                        </td>
                      </tr>

                      {/* Grupo3 rows */}
                      {isExpanded && section.lineas.map((line) => {
                        const lineKey = `${section.grupo1}::${line.grupo3}`;
                        const isLineExpanded = expandedLines.has(lineKey);
                        const isLineLoading = loadingLines.has(lineKey);
                        const detalle = detalleCache.get(lineKey);
                        const isCredit = CREDIT_LINES.has(line.grupo3);

                        return (
                          <Fragment key={lineKey}>
                            <tr
                              className="cursor-pointer border-b border-slate-100 bg-white hover:bg-slate-50/60 transition-colors"
                              onClick={() => void toggleLine(section.grupo1, line.grupo3)}
                            >
                              <td className="sticky left-0 bg-white py-1.5 pl-9 pr-3">
                                <div className="flex items-center gap-2">
                                  {isLineLoading ? <Spinner /> : <TriangleIcon open={isLineExpanded} />}
                                  <span className={isCredit ? "italic text-emerald-700" : "text-slate-600"}>
                                    {line.grupo3}
                                  </span>
                                </div>
                              </td>
                              {data.periodos.map((p) => (
                                <td key={p} className={`px-3 py-1.5 text-right tabular-nums ${isCredit ? "italic text-emerald-700" : "text-slate-600"}`}>
                                  {formatEerr(line.porPeriodo[p] ?? 0)}
                                </td>
                              ))}
                              <td className={`px-3 py-1.5 text-right tabular-nums border-l border-slate-100 ${isCredit ? "italic text-emerald-700 font-medium" : numCls(true)}`}>
                                {formatEerr(line.total)}
                              </td>
                            </tr>

                            {/* Categoria rows (nivel 3) */}
                            {isLineExpanded && detalle?.categorias.map((cat) => {
                              const catKey = `${section.grupo1}::${line.grupo3}::${cat.categoriaTipo}`;
                              const isCatExpanded = expandedCats.has(catKey);
                              return (
                                <Fragment key={catKey}>
                                  <tr
                                    className="cursor-pointer border-b border-slate-50 bg-slate-50/30 hover:bg-slate-50 transition-colors"
                                    onClick={() => toggleCat(section.grupo1, line.grupo3, cat.categoriaTipo)}
                                  >
                                    <td className="sticky left-0 bg-inherit py-1 pl-14 pr-3">
                                      <div className="flex items-center gap-2">
                                        <TriangleIcon open={isCatExpanded} />
                                        <span className="text-slate-500 text-[10px]">{cat.categoriaTipo}</span>
                                      </div>
                                    </td>
                                    {data.periodos.map((p) => (
                                      <td key={p} className="px-3 py-1 text-right tabular-nums text-[10px] text-slate-400">
                                        {formatEerr(cat.porPeriodo[p] ?? 0)}
                                      </td>
                                    ))}
                                    <td className="px-3 py-1 text-right tabular-nums text-[10px] text-slate-500 border-l border-slate-100">
                                      {formatEerr(cat.total)}
                                    </td>
                                  </tr>

                                  {/* Local / Arrendatario rows (nivel 4) */}
                                  {isCatExpanded && cat.locales.map((loc) => {
                                    const isActive = loc.arrendatarioId != null && arrendatarioPanel?.arrendatarioId === loc.arrendatarioId;
                                    return (
                                      <tr
                                        key={loc.localId}
                                        className={`border-b border-slate-50/60 transition-colors ${isActive ? "bg-brand-50/60" : "bg-white hover:bg-brand-50/20"} cursor-pointer`}
                                        onClick={() => {
                                          if (loc.arrendatarioId) {
                                            void openArrendatarioPanel({
                                              arrendatarioId: loc.arrendatarioId,
                                              nombre: loc.arrendatarioNombre ?? loc.localNombre,
                                              localCodigo: loc.localCodigo
                                            });
                                          }
                                        }}
                                      >
                                        <td className="sticky left-0 bg-inherit py-1 pl-[72px] pr-3">
                                          <span className="font-mono text-[10px] text-slate-300">[{loc.localCodigo}]</span>
                                          <span className={`ml-2 text-[10px] ${isActive ? "font-semibold text-brand-700" : "text-slate-400"}`}>
                                            {loc.arrendatarioNombre ?? loc.localNombre}
                                          </span>
                                          {loc.arrendatarioId && (
                                            <span className="ml-1.5 text-[9px] text-brand-400 opacity-0 group-hover:opacity-100">{"\u2197"}</span>
                                          )}
                                        </td>
                                        {data.periodos.map((p) => (
                                          <td key={p} className="px-3 py-1 text-right tabular-nums text-[10px] text-slate-400">
                                            {formatEerr(loc.porPeriodo[p] ?? 0)}
                                          </td>
                                        ))}
                                        <td className="px-3 py-1 text-right tabular-nums text-[10px] text-slate-400 border-l border-slate-100">
                                          {formatEerr(loc.total)}
                                        </td>
                                      </tr>
                                    );
                                  })}
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
                <tr className="border-t-[3px] border-b-[3px] border-slate-800 bg-white">
                  <td className="sticky left-0 bg-white py-3 pl-4 pr-3">
                    <span className="font-bold text-slate-900 uppercase tracking-widest text-[12px]">EBITDA</span>
                  </td>
                  {data.periodos.map((p) => {
                    const v = data.ebitda.porPeriodo[p] ?? 0;
                    return (
                      <td key={p} className="px-3 py-3 text-right text-[12px] font-bold tabular-nums text-slate-900">
                        {formatEerr(v)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-right text-[12px] font-bold tabular-nums text-slate-900 border-l border-slate-300">
                    {formatEerr(data.ebitda.total)}
                  </td>
                </tr>

                {/* Margen EBITDA */}
                {ingresos && (
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    <td className="sticky left-0 bg-inherit py-1 pl-4 pr-3 italic text-slate-400 text-[10px]">
                      Margen EBITDA
                    </td>
                    {data.periodos.map((p) => {
                      const ing = ingresos.porPeriodo[p] ?? 0;
                      const mg = calculateEbitdaMargin(ing, data.ebitda.porPeriodo[p] ?? 0);
                      return (
                        <td key={p} className="px-3 py-1 text-right text-[10px] italic tabular-nums text-slate-500">
                          {mg !== null ? `${mg.toFixed(1)}%` : "\u2014"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1 text-right text-[10px] italic text-slate-400 border-l border-slate-200">{"\u2014"}</td>
                  </tr>
                )}

                {/* Secciones bajo EBITDA */}
                {belowEbitdaSections.map((section) => {
                  const isExpanded = expandedSections.has(section.grupo1);
                  return (
                    <Fragment key={section.grupo1}>
                      <tr><td colSpan={data.periodos.length + 2} className="h-1 bg-slate-50" /></tr>
                      <tr
                        className="cursor-pointer border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                        onClick={() => toggleSection(section.grupo1)}
                      >
                        <td className="sticky left-0 bg-white py-2.5 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            <TriangleIcon open={isExpanded} />
                            <span className="font-bold text-slate-700 uppercase tracking-wide text-[11px]">
                              {section.grupo1}
                            </span>
                          </div>
                        </td>
                        {data.periodos.map((p) => (
                          <td key={p} className="px-3 py-2.5 text-right tabular-nums text-slate-700 font-semibold">
                            {formatEerr(section.porPeriodo[p] ?? 0)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-700 border-l border-slate-200">
                          {formatEerr(section.total)}
                        </td>
                      </tr>
                      {isExpanded && section.lineas.map((line) => (
                        <tr key={line.grupo3} className="border-b border-slate-100 bg-white">
                          <td className="sticky left-0 bg-white py-1.5 pl-9 pr-3 text-slate-600">{line.grupo3}</td>
                          {data.periodos.map((p) => (
                            <td key={p} className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                              {formatEerr(line.porPeriodo[p] ?? 0)}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-700 border-l border-slate-100">
                            {formatEerr(line.total)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}

                {/* EBIT */}
                {belowEbitdaSections.length > 0 && (
                  <tr className="border-t-[3px] border-b border-slate-800 bg-white">
                    <td className="sticky left-0 bg-white py-3 pl-4 pr-3">
                      <span className="font-bold text-slate-900 uppercase tracking-widest text-[12px]">EBIT</span>
                    </td>
                    {data.periodos.map((p) => {
                      const v = data.ebit.porPeriodo[p] ?? 0;
                      return (
                        <td key={p} className="px-3 py-3 text-right text-[12px] font-bold tabular-nums text-slate-900">
                          {formatEerr(v)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right text-[12px] font-bold tabular-nums text-slate-900 border-l border-slate-300">
                      {formatEerr(data.ebit.total)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>

      {/* Panel detalle arrendatario */}
      {arrendatarioPanel && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl ring-1 ring-black/10">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-200 px-5 py-4 bg-white">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{"Detalle de Facturaci\u00f3n"}</p>
              <p className="mt-1 text-base font-bold text-slate-900">{arrendatarioPanel.nombre}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  Local {arrendatarioPanel.localCodigo}
                </span>
                <span className="text-[10px] text-slate-400">
                  {desde ? formatPeriodo(desde.slice(0, 7)) : "inicio"} {"\u2014"} {hasta ? formatPeriodo(hasta.slice(0, 7)) : "hoy"}
                </span>
              </div>
            </div>
            <button
              onClick={() => { setArrendatarioPanel(null); setBillingData(null); }}
              className="ml-4 mt-1 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Cerrar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto">
            {loadingBilling ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Cargando...</div>
            ) : !billingData || billingData.lineas.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Sin registros para el periodo.</div>
            ) : (
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b-2 border-slate-300 bg-slate-50">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Partida
                    </th>
                    {billingData.periodos.map((p) => (
                      <th key={p} className="min-w-[72px] px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {formatPeriodo(p)}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide text-slate-700 border-l border-slate-200">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    billingData.lineas.reduce((acc, l) => {
                      if (!acc.has(l.grupo1)) acc.set(l.grupo1, []);
                      acc.get(l.grupo1)!.push(l);
                      return acc;
                    }, new Map<string, BillingLine[]>())
                  ).map(([g1, lineas], gIdx) => {
                    const g1Total = lineas.reduce((s, l) => s + l.total, 0);
                    const g1PorPeriodo: Record<string, number> = {};
                    for (const l of lineas) {
                      for (const [p, v] of Object.entries(l.porPeriodo)) {
                        g1PorPeriodo[p] = (g1PorPeriodo[p] ?? 0) + v;
                      }
                    }
                    return (
                      <Fragment key={g1}>
                        {gIdx > 0 && <tr><td colSpan={billingData.periodos.length + 2} className="h-1 bg-slate-50" /></tr>}
                        <tr className="border-b border-slate-200 bg-white">
                          <td className="py-2 pl-4 pr-3 font-bold text-slate-900 uppercase text-[10px] tracking-wide">
                            {g1}
                          </td>
                          {billingData.periodos.map((p) => (
                            <td key={p} className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                              {formatEerr(g1PorPeriodo[p] ?? 0)}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900 border-l border-slate-200">
                            {formatEerr(g1Total)}
                          </td>
                        </tr>
                        {lineas.map((l) => (
                          <tr key={l.grupo3} className="border-b border-slate-100 bg-white">
                            <td className="py-1.5 pl-9 pr-3 text-slate-600">{l.grupo3}</td>
                            {billingData.periodos.map((p) => (
                              <td key={p} className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                                {formatEerr(l.porPeriodo[p] ?? 0)}
                              </td>
                            ))}
                            <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 font-medium border-l border-slate-100">
                              {formatEerr(l.total)}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}

                  {/* Total general */}
                  <tr className="border-t-[3px] border-slate-800 bg-white">
                    <td className="py-3 pl-4 pr-3 font-bold uppercase tracking-widest text-[11px] text-slate-900">
                      Total
                    </td>
                    {billingData.periodos.map((p) => {
                      const v = billingData.lineas.reduce((s, l) => s + (l.porPeriodo[p] ?? 0), 0);
                      return (
                        <td key={p} className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">
                          {formatEerr(v)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-900 border-l border-slate-300">
                      {formatEerr(billingData.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </main>
  );
}




