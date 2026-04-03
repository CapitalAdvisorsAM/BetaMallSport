"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { calculateEbitdaMargin, getEerrValueTone } from "@/lib/finanzas/eerr";
import type { EerrData, EerrDetalleResponse, ProjectOption } from "@/types/finanzas";
import { formatUf } from "@/lib/utils";

type EERRClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

type ModoVista = "mensual" | "anual";

function aggregateByYear(data: EerrData): EerrData {
  const yearSet = new Set(data.periodos.map((p) => p.slice(0, 4)));
  const years = [...yearSet].sort();

  const secciones = data.secciones.map((section) => ({
    ...section,
    porPeriodo: Object.fromEntries(
      years.map((y) => [
        y,
        Object.entries(section.porPeriodo)
          .filter(([k]) => k.startsWith(y))
          .reduce((acc, [, v]) => acc + v, 0)
      ])
    ),
    lineas: section.lineas.map((line) => ({
      ...line,
      porPeriodo: Object.fromEntries(
        years.map((y) => [
          y,
          Object.entries(line.porPeriodo)
            .filter(([k]) => k.startsWith(y))
            .reduce((acc, [, v]) => acc + v, 0)
        ])
      )
    }))
  }));

  const ebitda = {
    total: data.ebitda.total,
    porPeriodo: Object.fromEntries(
      years.map((y) => [
        y,
        Object.entries(data.ebitda.porPeriodo)
          .filter(([k]) => k.startsWith(y))
          .reduce((acc, [, v]) => acc + v, 0)
      ])
    )
  };

  return { periodos: years, secciones, ebitda };
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

  // Nivel 1: secciones expandidas (grupo1)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  // Nivel 2→3: líneas expandidas (key: "grupo1::grupo3")
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  // Nivel 3→4: categorías expandidas (key: "grupo1::grupo3::cat")
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  // Cache de detalle por línea
  const [detalleCache, setDetalleCache] = useState<Map<string, EerrDetalleResponse>>(new Map());
  const [loadingLines, setLoadingLines] = useState<Set<string>>(new Set());

  const data = rawData && modo === "anual" ? aggregateByYear(rawData) : rawData;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId });
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const response = await fetch(`/api/finanzas/eerr?${params.toString()}`);
      const payload = (await response.json()) as EerrData;
      setRawData(payload);
      setExpandedSections(new Set(payload.secciones?.map((s) => s.grupo1) ?? []));
      setExpandedLines(new Set());
      setExpandedCats(new Set());
      setDetalleCache(new Map());
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function toggleSection(grupo1: string): void {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(grupo1) ? next.delete(grupo1) : next.add(grupo1);
      return next;
    });
  }

  async function toggleLine(grupo1: string, grupo3: string): Promise<void> {
    const key = `${grupo1}::${grupo3}`;
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      next.add(key);
      return next;
    });

    if (detalleCache.has(key)) return;

    setLoadingLines((prev) => new Set(prev).add(key));
    try {
      const params = new URLSearchParams({ proyectoId: selectedProjectId, grupo1, grupo3 });
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(`/api/finanzas/eerr/detalle?${params.toString()}`);
      const detalle = (await res.json()) as EerrDetalleResponse;
      setDetalleCache((prev) => new Map(prev).set(key, detalle));
    } finally {
      setLoadingLines((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function toggleCat(grupo1: string, grupo3: string, cat: string): void {
    const key = `${grupo1}::${grupo3}::${cat}`;
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="EE.RR"
        description="Estado de resultados consolidado del proyecto por periodo."
        projects={projects}
        selectedProjectId={selectedProjectId}
        preserve={{ desde, hasta }}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border border-slate-200 text-xs font-medium overflow-hidden">
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
            <ProjectPeriodToolbar
              desde={desde}
              hasta={hasta}
              onDesdeChange={setDesde}
              onHastaChange={setHasta}
            />
          </div>
        }
      />

      <ModuleSectionCard>
        {loading ? (
          <ModuleLoadingState message="Cargando EE.RR..." />
        ) : !data || data.secciones.length === 0 ? (
          <ModuleEmptyState
            message="Sin datos contables para el periodo seleccionado."
            actionHref={`/finanzas/upload?proyecto=${selectedProjectId}`}
            actionLabel="Cargar datos contables"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cuenta
                  </th>
                  {data.periodos.map((periodo) => (
                    <th
                      key={periodo}
                      className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {periodo}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.secciones.map((section) => (
                  <Fragment key={section.grupo1}>
                    {/* Nivel 1: GRUPO 1 */}
                    <tr
                      className="cursor-pointer border-b border-slate-100 bg-slate-50/80 hover:bg-slate-100"
                      onClick={() => toggleSection(section.grupo1)}
                    >
                      <td className="sticky left-0 bg-inherit px-4 py-2.5 font-semibold text-slate-800">
                        <span className="mr-2 text-slate-400">
                          {expandedSections.has(section.grupo1) ? "▼" : "▶"}
                        </span>
                        {section.grupo1}
                      </td>
                      {data.periodos.map((periodo) => (
                        <td
                          key={periodo}
                          className={`px-3 py-2.5 text-right font-semibold ${getEerrValueTone(section.tipo, section.porPeriodo[periodo] ?? 0)}`}
                        >
                          {section.porPeriodo[periodo] !== undefined ? formatUf(section.porPeriodo[periodo]) : "—"}
                        </td>
                      ))}
                      <td className={`px-3 py-2.5 text-right font-bold ${getEerrValueTone(section.tipo, section.total)}`}>
                        {formatUf(section.total)}
                      </td>
                    </tr>

                    {expandedSections.has(section.grupo1) &&
                      section.lineas.map((line) => {
                        const lineKey = `${section.grupo1}::${line.grupo3}`;
                        const isLineExpanded = expandedLines.has(lineKey);
                        const isLineLoading = loadingLines.has(lineKey);
                        const detalle = detalleCache.get(lineKey);

                        return (
                          <Fragment key={lineKey}>
                            {/* Nivel 2: GRUPO 3 */}
                            <tr
                              className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/60"
                              onClick={() => void toggleLine(section.grupo1, line.grupo3)}
                            >
                              <td className="sticky left-0 bg-white py-2 pl-10 pr-4 text-slate-600">
                                <span className="mr-1.5 text-slate-300">
                                  {isLineLoading ? "⏳" : isLineExpanded ? "▼" : "▶"}
                                </span>
                                {line.grupo3}
                              </td>
                              {data.periodos.map((periodo) => (
                                <td
                                  key={periodo}
                                  className={`px-3 py-2 text-right ${getEerrValueTone(line.tipo, line.porPeriodo[periodo] ?? 0)}`}
                                >
                                  {line.porPeriodo[periodo] !== undefined ? formatUf(line.porPeriodo[periodo]) : "—"}
                                </td>
                              ))}
                              <td className={`px-3 py-2 text-right font-medium ${getEerrValueTone(line.tipo, line.total)}`}>
                                {formatUf(line.total)}
                              </td>
                            </tr>

                            {isLineExpanded && detalle?.categorias.map((cat) => {
                              const catKey = `${section.grupo1}::${line.grupo3}::${cat.categoriaTipo}`;
                              const isCatExpanded = expandedCats.has(catKey);

                              return (
                                <Fragment key={catKey}>
                                  {/* Nivel 3: Categoría */}
                                  <tr
                                    className="cursor-pointer border-b border-slate-50/70 bg-slate-50/30 hover:bg-slate-50"
                                    onClick={() => toggleCat(section.grupo1, line.grupo3, cat.categoriaTipo)}
                                  >
                                    <td className="sticky left-0 bg-inherit py-1.5 pl-16 pr-4 text-xs text-slate-500">
                                      <span className="mr-1.5 text-slate-300">
                                        {isCatExpanded ? "▼" : "▶"}
                                      </span>
                                      {cat.categoriaTipo}
                                    </td>
                                    {data.periodos.map((periodo) => (
                                      <td key={periodo} className="px-3 py-1.5 text-right text-xs text-slate-500">
                                        {cat.porPeriodo[periodo] !== undefined ? formatUf(cat.porPeriodo[periodo]) : "—"}
                                      </td>
                                    ))}
                                    <td className="px-3 py-1.5 text-right text-xs font-medium text-slate-600">
                                      {formatUf(cat.total)}
                                    </td>
                                  </tr>

                                  {isCatExpanded && cat.locales.map((loc) => (
                                    /* Nivel 4: Local / Arrendatario */
                                    <tr key={loc.localId} className="border-b border-slate-50/40 bg-white hover:bg-slate-50/20">
                                      <td className="sticky left-0 bg-inherit py-1 pl-24 pr-4 text-xs text-slate-400">
                                        <span className="font-mono text-slate-300">[{loc.localCodigo}]</span>
                                        <span className="ml-1.5">{loc.arrendatarioNombre ?? loc.localNombre}</span>
                                      </td>
                                      {data.periodos.map((periodo) => (
                                        <td key={periodo} className="px-3 py-1 text-right text-xs text-slate-400">
                                          {loc.porPeriodo[periodo] !== undefined ? formatUf(loc.porPeriodo[periodo]) : "—"}
                                        </td>
                                      ))}
                                      <td className="px-3 py-1 text-right text-xs text-slate-500">
                                        {formatUf(loc.total)}
                                      </td>
                                    </tr>
                                  ))}
                                </Fragment>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                ))}

                {/* EBITDA */}
                <tr className="border-t-2 border-slate-300 bg-brand-700/5">
                  <td className="sticky left-0 bg-inherit px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-800">
                    EBITDA
                  </td>
                  {data.periodos.map((periodo) => {
                    const value = data.ebitda.porPeriodo[periodo] ?? 0;
                    return (
                      <td
                        key={periodo}
                        className={`px-3 py-3 text-right text-sm font-bold ${value >= 0 ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {formatUf(value)}
                      </td>
                    );
                  })}
                  <td className={`px-3 py-3 text-right text-sm font-bold ${data.ebitda.total >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {formatUf(data.ebitda.total)}
                  </td>
                </tr>

                {data.secciones.some((s) => s.tipo === "ingreso") ? (
                  <tr className="bg-brand-700/5">
                    <td className="sticky left-0 bg-inherit px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mg EBITDA (%)
                    </td>
                    {data.periodos.map((periodo) => {
                      const ingresos = data.secciones
                        .filter((s) => s.tipo === "ingreso")
                        .reduce((acc, s) => acc + (s.porPeriodo[periodo] ?? 0), 0);
                      const margin = calculateEbitdaMargin(ingresos, data.ebitda.porPeriodo[periodo] ?? 0);
                      return (
                        <td
                          key={periodo}
                          className={`px-3 py-2 text-right text-xs font-semibold ${margin !== null && margin >= 0 ? "text-emerald-600" : "text-red-500"}`}
                        >
                          {margin !== null ? `${formatUf(margin, 1)}%` : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right text-xs font-semibold text-slate-500">—</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>
    </main>
  );
}
