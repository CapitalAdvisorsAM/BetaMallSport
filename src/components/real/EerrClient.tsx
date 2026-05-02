"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { TableDisclosureButton } from "@/components/ui/TableDisclosureButton";
import { BELOW_EBITDA_GROUPS, EBIT_GROUPS, RESULTADO_GROUPS, calculateEbitdaMargin, formatEerr } from "@/lib/real/eerr";
import { getValueTone, getVarianceTone, TONE_TEXT_CLASS } from "@/lib/real/value-tone";
import { cn, formatPercent, formatUf, formatUfPerM2, groupPeriodosByYear } from "@/lib/utils";
import type { EerrData, EerrDetalleResponse } from "@/types/finance";

type BillingLine = { grupo1: string; grupo3: string; porPeriodo: Record<string, number>; total: number };
type BillingResponse = { periodos: string[]; lineas: BillingLine[]; total: number };
type ArrendatarioPanel = { arrendatarioId: string; nombre: string; localCodigo: string };

type EerrClientProps = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
  glaTotal?: number | null;
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
    secciones: (data.secciones ?? []).map((s) => ({
      ...s,
      porPeriodo: agg(s.porPeriodo),
      lineas: s.lineas.map((l) => ({ ...l, porPeriodo: agg(l.porPeriodo) })),
    })),
    ebitda:    { total: data.ebitda.total,    porPeriodo: agg(data.ebitda.porPeriodo) },
    ebit:      { total: data.ebit.total,      porPeriodo: agg(data.ebit.porPeriodo) },
    resultado: { total: data.resultado.total, porPeriodo: agg(data.resultado.porPeriodo) },
  };
}

const HEAD_CLS = "min-w-[90px] px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70 border-r border-white/10";
const GR = "border-r border-slate-100";
const CREDIT_LINES = new Set(["RECUPERACION GASTOS COMUNES", "FONDO DE PROMOCION"]);

export function EerrClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta,
  glaTotal,
}: EerrClientProps): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [modo, setModo] = useState<ModoVista>("mensual");
  const [rawData, setRawData] = useState<EerrData | null>(null);
  const [loading, setLoading] = useState(true);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [detalleCache, setDetalleCache] = useState<Map<string, EerrDetalleResponse>>(new Map());
  const [loadingLines, setLoadingLines] = useState<Set<string>>(new Set());

  const [arrendatarioPanel, setArrendatarioPanel] = useState<ArrendatarioPanel | null>(null);
  const [billingData, setBillingData] = useState<BillingResponse | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const billingCacheRef = useRef<Map<string, BillingResponse>>(new Map());

  const data = rawData && modo === "anual" ? aggregateByYear(rawData) : rawData;
  const hasBudgets = !!(data?.presupuestoEbitda);
  // label col + period cols + total col + (ppto + var% when budgets)
  const colCount = 1 + (data?.periodos.length ?? 0) + 1 + (hasBudgets ? 2 : 0);
  const yearGroups = groupPeriodosByYear(data?.periodos ?? []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/income-statement?${params}`);
      const payload = (await res.json()) as EerrData;
      setRawData(payload);
      setExpandedSections(new Set(payload.secciones?.map((s) => s.grupo1) ?? []));
      setExpandedLines(new Set());
      setDetalleCache(new Map());
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function toggleSection(g1: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(g1)) next.delete(g1); else next.add(g1);
      return next;
    });
  }

  async function toggleLine(g1: string, g3: string) {
    const key = `${g1}::${g3}`;
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    if (detalleCache.has(key)) return;
    setLoadingLines((p) => new Set(p).add(key));
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId, grupo1: g1, grupo3: g3 });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/income-statement/detail?${params}`);
      const d = (await res.json()) as EerrDetalleResponse;
      setDetalleCache((p) => new Map(p).set(key, d));
    } finally {
      setLoadingLines((p) => { const n = new Set(p); n.delete(key); return n; });
    }
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
      const params = new URLSearchParams({ projectId: selectedProjectId, arrendatarioId: panel.arrendatarioId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/tenants/detail?${params}`);
      const d = (await res.json()) as BillingResponse;
      billingCacheRef.current.set(cacheKey, d);
      setBillingData(d);
    } finally {
      setLoadingBilling(false);
    }
  }

  const ingresos = data?.secciones?.find((s) => s.grupo1 === "INGRESOS DE EXPLOTACION");
  const aboveEbitdaSections   = data?.secciones?.filter((s) => !BELOW_EBITDA_GROUPS.has(s.grupo1)) ?? [];
  const ebitDeductionSections = data?.secciones?.filter((s) => EBIT_GROUPS.has(s.grupo1))          ?? [];
  const resultSections        = data?.secciones?.filter((s) => RESULTADO_GROUPS.has(s.grupo1))     ?? [];

  const ingresoUfM2 =
    glaTotal && glaTotal > 0 && ingresos && data && data.periodos.length > 0
      ? ingresos.total / data.periodos.length / glaTotal
      : null;

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Estado de Resultados (UF)"
        description="Resultado consolidado del proyecto por periodo."
        valueBadges={["efectivo"]}
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

      {ingresoUfM2 !== null && (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <p className="text-sm text-slate-600">
            Ingreso mensual promedio:{" "}
            <span className="font-semibold text-slate-900">
              {formatUfPerM2(ingresoUfM2)} UF/m²
            </span>
            <span className="ml-2 text-xs text-slate-400">
              ({formatUf(ingresos!.total)} UF total ÷ {data!.periodos.length} períodos ÷ {formatUf(glaTotal!, 0)} m² GLA)
            </span>
          </p>
        </div>
      )}

      <ModuleSectionCard>
        {loading ? (
          <ModuleLoadingState message="Cargando Estado de Resultados..." />
        ) : !data || !data.secciones?.length ? (
          <ModuleEmptyState
            message="Sin datos contables para el periodo seleccionado."
            actionHref="/imports"
            actionLabel="Cargar datos contables"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse font-sans text-[11px]">

              {/* ── Header ─────────────────────────────────────────── */}
              <thead>
                {yearGroups.length > 1 && (
                  <tr className="bg-brand-700">
                    <th className="sticky left-0 z-10 w-72 bg-brand-700 py-0.5 border-r border-white/10" />
                    {yearGroups.map(({ year, count }, idx) => (
                      <th
                        key={year}
                        colSpan={count}
                        className={cn(
                          "py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-white/30",
                          idx > 0 && "border-l border-white/15"
                        )}
                      >
                        {year}
                      </th>
                    ))}
                    <th className="py-0.5 border-l border-white/15" />
                    {hasBudgets && <th className="py-0.5" />}
                    {hasBudgets && <th className="py-0.5" />}
                  </tr>
                )}
                <tr className="border-b border-slate-200 bg-brand-700">
                  <th className="sticky left-0 z-10 w-72 bg-brand-700 py-2.5 pl-4 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70 border-r border-white/10">
                    En UF
                  </th>
                  {data.periodos.map((p) => (
                    <th key={p} className={HEAD_CLS}>{formatPeriodo(p)}</th>
                  ))}
                  <th className={HEAD_CLS}>Total</th>
                  {hasBudgets && <th className={HEAD_CLS}>Ppto</th>}
                  {hasBudgets && <th className={cn(HEAD_CLS, "text-amber-300")}>Var %</th>}
                </tr>
              </thead>

              <tbody>
                {/* ── Sections above EBITDA ──────────────────────── */}
                {aboveEbitdaSections.map((section, sIdx) => {
                  const isExpanded = expandedSections.has(section.grupo1);
                  return (
                    <Fragment key={section.grupo1}>
                      {sIdx > 0 && (
                        <tr><td colSpan={colCount} className="h-1 bg-slate-50" /></tr>
                      )}

                      {/* Section header row */}
                      <tr className="border-b border-slate-200 bg-white transition-colors hover:bg-slate-50">
                        <td className="sticky left-0 z-10 bg-white py-2.5 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            <TableDisclosureButton
                              expanded={isExpanded}
                              label={`${isExpanded ? "Contraer" : "Expandir"} sección ${section.grupo1}`}
                              onToggle={() => toggleSection(section.grupo1)}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-900">
                              {section.grupo1}
                            </span>
                          </div>
                        </td>
                        {data.periodos.map((p) => {
                          const v = section.porPeriodo[p] ?? 0;
                          return (
                            <td key={p} className={cn("px-3 py-2.5 text-right tabular-nums font-semibold", GR, TONE_TEXT_CLASS[getValueTone(section.tipo, v)])}>
                              {formatEerr(v)}
                            </td>
                          );
                        })}
                        <td className={cn("px-3 py-2.5 text-right tabular-nums border-l border-slate-200 font-bold", TONE_TEXT_CLASS[getValueTone(section.tipo, section.total)])}>
                          {formatEerr(section.total)}
                        </td>
                        {hasBudgets && (
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-600">
                            {section.presupuestoTotal != null ? formatEerr(section.presupuestoTotal) : "—"}
                          </td>
                        )}
                        {hasBudgets && (
                          <td className={cn("px-3 py-2.5 text-right tabular-nums font-semibold", TONE_TEXT_CLASS[getVarianceTone(section.tipo, section.varianzaPct ?? null)])}>
                            {section.varianzaPct != null ? formatPercent(section.varianzaPct) : "—"}
                          </td>
                        )}
                      </tr>

                      {/* Line rows */}
                      {isExpanded && section.lineas.map((line, lineIdx) => {
                        const lineKey = `${section.grupo1}::${line.grupo3}`;
                        const isLineExpanded = expandedLines.has(lineKey);
                        const isLineLoading = loadingLines.has(lineKey);
                        const detalle = detalleCache.get(lineKey);
                        const isCredit = CREDIT_LINES.has(line.grupo3);
                        const lineBg = lineIdx % 2 === 0 ? "bg-white" : "bg-slate-50";

                        return (
                          <Fragment key={lineKey}>
                            <tr className={cn("border-b border-slate-100 transition-colors hover:bg-slate-100/60", lineBg)}>
                              <td className={cn("sticky left-0 z-10 py-1.5 pl-9 pr-3", lineBg)}>
                                <div className="flex items-center gap-2">
                                  <TableDisclosureButton
                                    expanded={isLineExpanded}
                                    loading={isLineLoading}
                                    label={`${isLineExpanded ? "Contraer" : "Expandir"} línea ${line.grupo3}`}
                                    onToggle={() => { void toggleLine(section.grupo1, line.grupo3); }}
                                    className="h-5 w-5"
                                  />
                                  <span className={isCredit ? "italic text-emerald-700" : "text-slate-600"}>
                                    {line.grupo3}
                                  </span>
                                </div>
                              </td>
                              {data.periodos.map((p) => {
                                const v = line.porPeriodo[p] ?? 0;
                                return (
                                  <td key={p} className={cn(
                                    "px-3 py-1.5 text-right tabular-nums",
                                    GR,
                                    isCredit ? "italic text-emerald-700" : TONE_TEXT_CLASS[getValueTone(line.tipo, v)]
                                  )}>
                                    {formatEerr(v)}
                                  </td>
                                );
                              })}
                              <td className={cn(
                                "px-3 py-1.5 text-right tabular-nums border-l border-slate-100 font-medium",
                                isCredit ? "italic text-emerald-700" : TONE_TEXT_CLASS[getValueTone(line.tipo, line.total)]
                              )}>
                                {formatEerr(line.total)}
                              </td>
                              {hasBudgets && (
                                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                                  {line.presupuestoTotal != null ? formatEerr(line.presupuestoTotal) : "—"}
                                </td>
                              )}
                              {hasBudgets && (
                                <td className={cn("px-3 py-1.5 text-right tabular-nums", TONE_TEXT_CLASS[getVarianceTone(line.tipo, line.varianzaPct ?? null)])}>
                                  {line.varianzaPct != null ? formatPercent(line.varianzaPct) : "—"}
                                </td>
                              )}
                            </tr>

                            {/* Category + tenant drill-down rows */}
                            {isLineExpanded && detalle?.categorias.map((cat) => (
                              <Fragment key={cat.categoriaTipo}>
                                <tr className="border-b border-slate-100 bg-slate-50">
                                  <td className="sticky left-0 z-10 bg-inherit py-1.5 pl-14 pr-3">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                      {cat.categoriaTipo}
                                    </span>
                                  </td>
                                  {data.periodos.map((p) => (
                                    <td key={p} className={cn("px-3 py-1.5 text-right tabular-nums text-[11px] text-slate-500", GR)}>
                                      {formatEerr(cat.porPeriodo[p] ?? 0)}
                                    </td>
                                  ))}
                                  <td className="px-3 py-1.5 text-right tabular-nums text-[11px] font-medium text-slate-600 border-l border-slate-100">
                                    {formatEerr(cat.total)}
                                  </td>
                                  {hasBudgets && <td colSpan={2} />}
                                </tr>

                                {cat.locales.map((loc) => {
                                  const isActive = loc.arrendatarioId != null && arrendatarioPanel?.arrendatarioId === loc.arrendatarioId;
                                  return (
                                    <tr
                                      key={loc.localId}
                                      className={cn(
                                        "border-b border-slate-50 transition-colors",
                                        isActive ? "bg-brand-50/60" : "bg-white hover:bg-brand-50/30"
                                      )}
                                    >
                                      <td className="sticky left-0 z-10 bg-inherit py-1.5 pl-[72px] pr-3">
                                        <span className="font-mono text-[10px] text-slate-400">[{loc.localCodigo}]</span>
                                        {loc.arrendatarioId ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              void openArrendatarioPanel({
                                                arrendatarioId: loc.arrendatarioId!,
                                                nombre: loc.arrendatarioNombre ?? loc.localNombre,
                                                localCodigo: loc.localCodigo,
                                              });
                                            }}
                                            className={cn(
                                              "ml-2 inline-flex items-center gap-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1",
                                              isActive ? "font-semibold text-brand-700" : "text-slate-600 hover:text-brand-700"
                                            )}
                                          >
                                            {loc.arrendatarioNombre ?? loc.localNombre}
                                            <span className="text-[10px] text-brand-400">↗</span>
                                          </button>
                                        ) : (
                                          <span className="ml-2 text-[11px] text-slate-600">
                                            {loc.arrendatarioNombre ?? loc.localNombre}
                                          </span>
                                        )}
                                      </td>
                                      {data.periodos.map((p) => (
                                        <td key={p} className={cn("px-3 py-1.5 text-right tabular-nums text-[11px] text-slate-600", GR)}>
                                          {formatEerr(loc.porPeriodo[p] ?? 0)}
                                        </td>
                                      ))}
                                      <td className="px-3 py-1.5 text-right tabular-nums text-[11px] font-medium text-slate-700 border-l border-slate-100">
                                        {formatEerr(loc.total)}
                                      </td>
                                      {hasBudgets && <td colSpan={2} />}
                                    </tr>
                                  );
                                })}
                              </Fragment>
                            ))}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}

                {/* ── EBITDA ─────────────────────────────────────── */}
                <tr className="border-t-[3px] border-b-[3px] border-slate-800 bg-white">
                  <td className="sticky left-0 z-10 bg-white py-3 pl-4 pr-3">
                    <span className="text-[12px] font-bold uppercase tracking-widest text-slate-900">EBITDA</span>
                  </td>
                  {data.periodos.map((p) => {
                    const v = data.ebitda.porPeriodo[p] ?? 0;
                    return (
                      <td key={p} className={cn("px-3 py-3 text-right text-[12px] font-bold tabular-nums", GR, TONE_TEXT_CLASS[getValueTone("ingreso", v)])}>
                        {formatEerr(v)}
                      </td>
                    );
                  })}
                  <td className={cn("px-3 py-3 text-right text-[12px] font-bold tabular-nums border-l border-slate-300", TONE_TEXT_CLASS[getValueTone("ingreso", data.ebitda.total)])}>
                    {formatEerr(data.ebitda.total)}
                  </td>
                  {hasBudgets && data.presupuestoEbitda && (
                    <td className="px-3 py-3 text-right text-[12px] font-bold tabular-nums text-slate-600">
                      {formatEerr(data.presupuestoEbitda.total)}
                    </td>
                  )}
                  {hasBudgets && data.presupuestoEbitda && (() => {
                    const pptoTotal = data.presupuestoEbitda!.total;
                    const varianzaPct = pptoTotal !== 0
                      ? ((data.ebitda.total - pptoTotal) / Math.abs(pptoTotal)) * 100
                      : null;
                    return (
                      <td className={cn("px-3 py-3 text-right text-[12px] font-bold tabular-nums", TONE_TEXT_CLASS[getVarianceTone("ingreso", varianzaPct)])}>
                        {varianzaPct != null ? formatPercent(varianzaPct) : "—"}
                      </td>
                    );
                  })()}
                  {hasBudgets && !data.presupuestoEbitda && <td colSpan={2} />}
                </tr>

                {/* EBITDA margin row */}
                {ingresos && (
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    <td className="sticky left-0 z-10 bg-inherit py-1 pl-4 pr-3 text-[10px] italic text-slate-400">
                      Margen EBITDA
                    </td>
                    {data.periodos.map((p) => {
                      const ing = ingresos.porPeriodo[p] ?? 0;
                      const mg = calculateEbitdaMargin(ing, data.ebitda.porPeriodo[p] ?? 0);
                      return (
                        <td key={p} className={cn("px-3 py-1 text-right text-[10px] italic tabular-nums text-slate-500", GR)}>
                          {mg !== null ? formatPercent(mg) : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1 text-right text-[10px] italic text-slate-400 border-l border-slate-200">—</td>
                    {hasBudgets && <td colSpan={2} />}
                  </tr>
                )}

                {/* ── DEPRECIACION / EDI (entre EBITDA y EBIT) ──── */}
                {ebitDeductionSections.map((section) => {
                  const isExpanded = expandedSections.has(section.grupo1);
                  return (
                    <Fragment key={section.grupo1}>
                      <tr><td colSpan={colCount} className="h-1 bg-slate-50" /></tr>
                      <tr className="border-b border-slate-200 bg-white transition-colors hover:bg-slate-50">
                        <td className="sticky left-0 z-10 bg-white py-2.5 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            <TableDisclosureButton
                              expanded={isExpanded}
                              label={`${isExpanded ? "Contraer" : "Expandir"} sección ${section.grupo1}`}
                              onToggle={() => toggleSection(section.grupo1)}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                              {section.grupo1}
                            </span>
                          </div>
                        </td>
                        {data.periodos.map((p) => {
                          const v = section.porPeriodo[p] ?? 0;
                          return (
                            <td key={p} className={cn("px-3 py-2.5 text-right tabular-nums font-semibold", GR, TONE_TEXT_CLASS[getValueTone(section.tipo, v)])}>
                              {formatEerr(v)}
                            </td>
                          );
                        })}
                        <td className={cn("px-3 py-2.5 text-right tabular-nums font-semibold border-l border-slate-200", TONE_TEXT_CLASS[getValueTone(section.tipo, section.total)])}>
                          {formatEerr(section.total)}
                        </td>
                        {hasBudgets && (
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-600">
                            {section.presupuestoTotal != null ? formatEerr(section.presupuestoTotal) : "—"}
                          </td>
                        )}
                        {hasBudgets && (
                          <td className={cn("px-3 py-2.5 text-right tabular-nums font-semibold", TONE_TEXT_CLASS[getVarianceTone(section.tipo, section.varianzaPct ?? null)])}>
                            {section.varianzaPct != null ? formatPercent(section.varianzaPct) : "—"}
                          </td>
                        )}
                      </tr>
                      {isExpanded && section.lineas.map((line, lineIdx) => {
                        const lineBg = lineIdx % 2 === 0 ? "bg-white" : "bg-slate-50";
                        return (
                          <tr key={line.grupo3} className={cn("border-b border-slate-100 transition-colors hover:bg-slate-100/60", lineBg)}>
                            <td className={cn("sticky left-0 z-10 py-1.5 pl-9 pr-3 text-slate-600", lineBg)}>{line.grupo3}</td>
                            {data.periodos.map((p) => {
                              const v = line.porPeriodo[p] ?? 0;
                              return (
                                <td key={p} className={cn("px-3 py-1.5 text-right tabular-nums", GR, TONE_TEXT_CLASS[getValueTone(line.tipo, v)])}>
                                  {formatEerr(v)}
                                </td>
                              );
                            })}
                            <td className={cn("px-3 py-1.5 text-right tabular-nums font-medium border-l border-slate-100", TONE_TEXT_CLASS[getValueTone(line.tipo, line.total)])}>
                              {formatEerr(line.total)}
                            </td>
                            {hasBudgets && (
                              <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                                {line.presupuestoTotal != null ? formatEerr(line.presupuestoTotal) : "—"}
                              </td>
                            )}
                            {hasBudgets && (
                              <td className={cn("px-3 py-1.5 text-right tabular-nums", TONE_TEXT_CLASS[getVarianceTone(line.tipo, line.varianzaPct ?? null)])}>
                                {line.varianzaPct != null ? formatPercent(line.varianzaPct) : "—"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}

                {/* ── EBIT ───────────────────────────────────────── */}
                {ebitDeductionSections.length > 0 && (
                  <tr className="border-t-[3px] border-b border-slate-800 bg-white">
                    <td className="sticky left-0 z-10 bg-white py-3 pl-4 pr-3">
                      <span className="text-[12px] font-bold uppercase tracking-widest text-slate-900">EBIT</span>
                    </td>
                    {data.periodos.map((p) => {
                      const v = data.ebit.porPeriodo[p] ?? 0;
                      return (
                        <td key={p} className={cn("px-3 py-3 text-right text-[12px] font-bold tabular-nums", GR, TONE_TEXT_CLASS[getValueTone("ingreso", v)])}>
                          {formatEerr(v)}
                        </td>
                      );
                    })}
                    <td className={cn("px-3 py-3 text-right text-[12px] font-bold tabular-nums border-l border-slate-300", TONE_TEXT_CLASS[getValueTone("ingreso", data.ebit.total)])}>
                      {formatEerr(data.ebit.total)}
                    </td>
                    {hasBudgets && <td colSpan={2} />}
                  </tr>
                )}

                {/* ── RESULTADO NO OPERACIONAL / IMPUESTOS ───────── */}
                {resultSections.map((section) => {
                  const isExpanded = expandedSections.has(section.grupo1);
                  return (
                    <Fragment key={section.grupo1}>
                      <tr><td colSpan={colCount} className="h-1 bg-slate-50" /></tr>
                      <tr className="border-b border-slate-200 bg-white transition-colors hover:bg-slate-50">
                        <td className="sticky left-0 z-10 bg-white py-2.5 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            <TableDisclosureButton
                              expanded={isExpanded}
                              label={`${isExpanded ? "Contraer" : "Expandir"} sección ${section.grupo1}`}
                              onToggle={() => toggleSection(section.grupo1)}
                            />
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                              {section.grupo1}
                            </span>
                          </div>
                        </td>
                        {data.periodos.map((p) => {
                          const v = section.porPeriodo[p] ?? 0;
                          return (
                            <td key={p} className={cn("px-3 py-2.5 text-right tabular-nums font-semibold", GR, TONE_TEXT_CLASS[getValueTone(section.tipo, v)])}>
                              {formatEerr(v)}
                            </td>
                          );
                        })}
                        <td className={cn("px-3 py-2.5 text-right tabular-nums font-semibold border-l border-slate-200", TONE_TEXT_CLASS[getValueTone(section.tipo, section.total)])}>
                          {formatEerr(section.total)}
                        </td>
                        {hasBudgets && (
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-600">
                            {section.presupuestoTotal != null ? formatEerr(section.presupuestoTotal) : "—"}
                          </td>
                        )}
                        {hasBudgets && (
                          <td className={cn("px-3 py-2.5 text-right tabular-nums font-semibold", TONE_TEXT_CLASS[getVarianceTone(section.tipo, section.varianzaPct ?? null)])}>
                            {section.varianzaPct != null ? formatPercent(section.varianzaPct) : "—"}
                          </td>
                        )}
                      </tr>
                      {isExpanded && section.lineas.map((line, lineIdx) => {
                        const lineBg = lineIdx % 2 === 0 ? "bg-white" : "bg-slate-50";
                        return (
                          <tr key={line.grupo3} className={cn("border-b border-slate-100 transition-colors hover:bg-slate-100/60", lineBg)}>
                            <td className={cn("sticky left-0 z-10 py-1.5 pl-9 pr-3 text-slate-600", lineBg)}>{line.grupo3}</td>
                            {data.periodos.map((p) => {
                              const v = line.porPeriodo[p] ?? 0;
                              return (
                                <td key={p} className={cn("px-3 py-1.5 text-right tabular-nums", GR, TONE_TEXT_CLASS[getValueTone(line.tipo, v)])}>
                                  {formatEerr(v)}
                                </td>
                              );
                            })}
                            <td className={cn("px-3 py-1.5 text-right tabular-nums font-medium border-l border-slate-100", TONE_TEXT_CLASS[getValueTone(line.tipo, line.total)])}>
                              {formatEerr(line.total)}
                            </td>
                            {hasBudgets && (
                              <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                                {line.presupuestoTotal != null ? formatEerr(line.presupuestoTotal) : "—"}
                              </td>
                            )}
                            {hasBudgets && (
                              <td className={cn("px-3 py-1.5 text-right tabular-nums", TONE_TEXT_CLASS[getVarianceTone(line.tipo, line.varianzaPct ?? null)])}>
                                {line.varianzaPct != null ? formatPercent(line.varianzaPct) : "—"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}

                {/* ── RESULTADO DEL EJERCICIO ────────────────────── */}
                {resultSections.length > 0 && (
                  <tr className="border-t-[3px] border-b border-slate-800 bg-white">
                    <td className="sticky left-0 z-10 bg-white py-3 pl-4 pr-3">
                      <span className="text-[12px] font-bold uppercase tracking-widest text-slate-900">RESULTADO DEL EJERCICIO</span>
                    </td>
                    {data.periodos.map((p) => {
                      const v = data.resultado.porPeriodo[p] ?? 0;
                      return (
                        <td key={p} className={cn("px-3 py-3 text-right text-[12px] font-bold tabular-nums", GR, TONE_TEXT_CLASS[getValueTone("ingreso", v)])}>
                          {formatEerr(v)}
                        </td>
                      );
                    })}
                    <td className={cn("px-3 py-3 text-right text-[12px] font-bold tabular-nums border-l border-slate-300", TONE_TEXT_CLASS[getValueTone("ingreso", data.resultado.total)])}>
                      {formatEerr(data.resultado.total)}
                    </td>
                    {hasBudgets && <td colSpan={2} />}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>

      {/* ── Billing detail panel ───────────────────────────────────── */}
      {arrendatarioPanel && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-start justify-between border-b-2 border-slate-200 bg-white px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Detalle de Facturación</p>
              <p className="mt-1 text-base font-bold text-slate-900">{arrendatarioPanel.nombre}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                  Local {arrendatarioPanel.localCodigo}
                </span>
                <span className="text-[10px] text-slate-400">
                  {desde ? formatPeriodo(desde.slice(0, 7)) : "inicio"} — {hasta ? formatPeriodo(hasta.slice(0, 7)) : "hoy"}
                </span>
              </div>
            </div>
            <button
              onClick={() => { setArrendatarioPanel(null); setBillingData(null); }}
              className="ml-4 mt-1 rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cerrar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingBilling ? (
              <div className="flex items-center justify-center py-20 text-sm text-slate-400">Cargando...</div>
            ) : !billingData || billingData.lineas.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-sm text-slate-400">Sin registros para el periodo.</div>
            ) : (
              <table className="min-w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-brand-700">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Partida
                    </th>
                    {billingData.periodos.map((p) => (
                      <th key={p} className="min-w-[72px] px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                        {formatPeriodo(p)}
                      </th>
                    ))}
                    <th className="border-l border-white/10 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
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
                          <td className="py-2 pl-4 pr-3 text-[10px] font-bold uppercase tracking-wide text-slate-900">{g1}</td>
                          {billingData.periodos.map((p) => (
                            <td key={p} className="px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                              {formatEerr(g1PorPeriodo[p] ?? 0)}
                            </td>
                          ))}
                          <td className="border-l border-slate-200 px-3 py-2 text-right font-bold tabular-nums text-slate-900">
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
                            <td className="border-l border-slate-100 px-3 py-1.5 text-right font-medium tabular-nums text-slate-700">
                              {formatEerr(l.total)}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}

                  <tr className="border-t-[3px] border-slate-800 bg-white">
                    <td className="py-3 pl-4 pr-3 text-[11px] font-bold uppercase tracking-widest text-slate-900">Total</td>
                    {billingData.periodos.map((p) => {
                      const v = billingData.lineas.reduce((s, l) => s + (l.porPeriodo[p] ?? 0), 0);
                      return (
                        <td key={p} className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">
                          {formatEerr(v)}
                        </td>
                      );
                    })}
                    <td className="border-l border-slate-300 px-3 py-3 text-right font-bold tabular-nums text-slate-900">
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
