"use client";

import { useCallback, useEffect, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { UnifiedTable } from "@/components/ui/UnifiedTable";
import { getStripedRowClass, getTableTheme } from "@/components/ui/table-theme";
import { formatEerr } from "@/lib/finance/eerr";
import type { AnalisisFila, AnalisisResponse } from "@/app/api/finance/analysis/route";
import type { ProjectOption } from "@/types/finance";

type DimensionType = "arrendatario" | "local" | "categoria" | "seccion" | "piso";
type OrdenType = "nombre" | "total_desc" | "total_asc";

const DIMENSION_LABELS: Record<DimensionType, string> = {
  arrendatario: "Arrendatario",
  local: "Local",
  categoria: "Categoría (Grupo 3)",
  seccion: "Sección (Grupo 1)",
  piso: "Piso"
};

const ORDEN_LABELS: Record<OrdenType, string> = {
  nombre: "Nombre A-Z",
  total_desc: "Mayor total",
  total_asc: "Menor total"
};
const compactTableTheme = getTableTheme("compact");

type Props = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

function valueCls(v: number): string {
  if (v === 0) return "text-slate-300";
  return v < 0 ? "text-red-600" : "text-slate-800";
}

export function FinanceAnalysisClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [dimension, setDimension] = useState<DimensionType>("seccion");
  const [orden, setOrden] = useState<OrdenType>("total_desc");
  const [grupo3Seleccionados, setGrupo3Seleccionados] = useState<Set<string>>(new Set());
  const [filtroAbierto, setFiltroAbierto] = useState(false);

  const [data, setData] = useState<AnalisisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [allGrupo3, setAllGrupo3] = useState<string[]>([]);

  // First load: get available grupo3 options
  const fetchOpciones = useCallback(async () => {
    const params = new URLSearchParams({ projectId: selectedProjectId });
    if (desde) params.set("from", desde);
    if (hasta) params.set("to", hasta);
    params.set("dimension", "seccion");
    params.set("orden", "nombre");
    const res = await fetch(`/api/finance/analysis?${params}`);
    const d = (await res.json()) as AnalisisResponse;
    setAllGrupo3(d.grupo3Disponibles ?? []);
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => { void fetchOpciones(); }, [fetchOpciones]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId, dimension, orden });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      if (grupo3Seleccionados.size > 0) {
        params.set("grupo3s", [...grupo3Seleccionados].join(","));
      }
      const res = await fetch(`/api/finance/analysis?${params}`);
      setData((await res.json()) as AnalisisResponse);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, dimension, orden, desde, hasta, grupo3Seleccionados]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function toggleGrupo3(g: string) {
    setGrupo3Seleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(g)) {
        next.delete(g);
      } else {
        next.add(g);
      }
      return next;
    });
  }

  function selectAllGrupo3() {
    setGrupo3Seleccionados(new Set());
  }

  const periodos = data?.periodos ?? [];
  const filas = data?.filas ?? [];

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Análisis de Facturación"
        description="Vista flexible de los registros contables. Elige dimensión, tipo de cobro y periodo."
        projects={projects}
        selectedProjectId={selectedProjectId}
        preserve={{ desde, hasta }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProjectPeriodToolbar desde={desde} hasta={hasta} onDesdeChange={setDesde} onHastaChange={setHasta} />
          </div>
        }
      />

      {/* Toolbar de controles */}
      <ModuleSectionCard>
        <div className="flex flex-wrap items-start gap-4">
          {/* Dimensión */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ver por</label>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(DIMENSION_LABELS) as DimensionType[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDimension(d)}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    dimension === d
                      ? "bg-brand-700 text-white"
                      : "border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  {DIMENSION_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Orden */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ordenar</label>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenType)}
              className="rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {(Object.keys(ORDEN_LABELS) as OrdenType[]).map((o) => (
                <option key={o} value={o}>{ORDEN_LABELS[o]}</option>
              ))}
            </select>
          </div>

          {/* Filtro tipos (grupo3) */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de cobro</label>
            <button
              onClick={() => setFiltroAbierto((p) => !p)}
              className="flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-brand-300"
            >
              {grupo3Seleccionados.size === 0
                ? "Todos"
                : `${grupo3Seleccionados.size} seleccionado${grupo3Seleccionados.size > 1 ? "s" : ""}`}
              <span className="text-slate-400">{filtroAbierto ? "▲" : "▼"}</span>
            </button>
            {filtroAbierto && (
              <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="sticky top-0 border-b border-slate-100 bg-white px-3 py-2">
                  <button onClick={selectAllGrupo3} className="text-xs text-brand-600 hover:underline">
                    Seleccionar todos
                  </button>
                </div>
                {allGrupo3.map((g) => (
                  <label key={g} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={grupo3Seleccionados.has(g)}
                      onChange={() => toggleGrupo3(g)}
                      className="rounded accent-brand-600"
                    />
                    {g}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModuleSectionCard>

      {/* Tabla */}
      <ModuleSectionCard>
        {loading ? (
          <ModuleLoadingState message="Cargando análisis..." />
        ) : !data || filas.length === 0 ? (
          <ModuleEmptyState
            message="Sin datos para los filtros seleccionados."
            actionHref={`/finance/upload?project=${selectedProjectId}`}
            actionLabel="Cargar datos contables"
          />
        ) : (
          <UnifiedTable
            density="compact"
            toolbar={
              <p className="text-xs text-slate-400">
                {filas.length} {DIMENSION_LABELS[dimension].toLowerCase()}
                {grupo3Seleccionados.size > 0 && ` · Filtrado por ${grupo3Seleccionados.size} tipo(s)`}
              </p>
            }
          >
            <table className={`${compactTableTheme.table} text-xs`}>
              <thead className={compactTableTheme.head}>
                <tr>
                  <th className={`${compactTableTheme.headCell} sticky left-0 bg-brand-700 pl-4 pr-3`}>
                    {DIMENSION_LABELS[dimension]}
                  </th>
                  {periodos.map((p) => (
                    <th key={p} className={`${compactTableTheme.compactHeadCell} min-w-[80px] text-right`}>{p}</th>
                  ))}
                  <th className={`${compactTableTheme.compactHeadCell} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((fila: AnalisisFila, idx) => (
                  <tr
                    key={fila.id}
                    className={`${getStripedRowClass(idx, "compact")} ${compactTableTheme.rowHover}`}
                  >
                    <td className="sticky left-0 bg-inherit py-1.5 pl-4 pr-3">
                      <span className="font-medium text-slate-700">{fila.nombre}</span>
                      {fila.sub && <span className="ml-1.5 text-slate-400">· {fila.sub}</span>}
                    </td>
                    {periodos.map((p) => (
                      <td key={p} className={`px-2 py-1.5 text-right ${valueCls(fila.porPeriodo[p] ?? 0)}`}>
                        {formatEerr(fila.porPeriodo[p] ?? 0)}
                      </td>
                    ))}
                    <td className={`px-2 py-1.5 text-right font-semibold ${valueCls(fila.total)}`}>
                      {formatEerr(fila.total)}
                    </td>
                  </tr>
                ))}
                {/* Fila totales */}
                <tr className="border-t-2 border-brand-600 bg-brand-700 text-white hover:bg-brand-700">
                  <td className="sticky left-0 bg-brand-700 py-2 pl-4 pr-3 text-xs font-bold uppercase tracking-wide">
                    Total
                  </td>
                  {periodos.map((p) => {
                    const v = data.totalesPorPeriodo[p] ?? 0;
                    return (
                      <td key={p} className={`px-2 py-2 text-right text-xs font-bold ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatEerr(v)}
                      </td>
                    );
                  })}
                  <td className={`px-2 py-2 text-right text-xs font-bold ${data.totalGeneral >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatEerr(data.totalGeneral)}
                  </td>
                </tr>
              </tbody>
            </table>
          </UnifiedTable>
        )}
      </ModuleSectionCard>
    </main>
  );
}




