"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { Button } from "@/components/ui/button";
import { buildExportExcelUrl } from "@/lib/export/shared";
import { calculateEbitdaMargin, getEerrValueTone } from "@/lib/finanzas/eerr";
import type { EerrData, ProjectOption } from "@/types/finanzas";
import { formatUf } from "@/lib/utils";

type EERRClientProps = {
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

export function EERRClient({
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: EERRClientProps): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<EerrData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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

      const response = await fetch(`/api/finanzas/eerr?${params.toString()}`);
      const payload = (await response.json()) as EerrData;
      setData(payload);
      setExpandedSections(new Set(payload.secciones?.map((section) => section.grupo1) ?? []));
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function toggleSection(sectionName: string): void {
    setExpandedSections((previous) => {
      const next = new Set(previous);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  }

  const filteredExportHref = buildExportExcelUrl({
    dataset: "finanzas_eerr",
    scope: "filtered",
    proyectoId: selectedProjectId,
    desde: desde || undefined,
    hasta: hasta || undefined
  });
  const allExportHref = buildExportExcelUrl({
    dataset: "finanzas_eerr",
    scope: "all",
    proyectoId: selectedProjectId
  });

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="EE.RR"
        description="Estado de resultados consolidado del proyecto por periodo."
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
                      {periodo.slice(0, 7)}
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
                          className={`px-3 py-2.5 text-right font-semibold ${getEerrValueTone(
                            section.tipo,
                            section.porPeriodo[periodo] ?? 0
                          )}`}
                        >
                          {section.porPeriodo[periodo] !== undefined
                            ? formatUf(section.porPeriodo[periodo])
                            : "—"}
                        </td>
                      ))}
                      <td
                        className={`px-3 py-2.5 text-right font-bold ${getEerrValueTone(
                          section.tipo,
                          section.total
                        )}`}
                      >
                        {formatUf(section.total)}
                      </td>
                    </tr>

                    {expandedSections.has(section.grupo1)
                      ? section.lineas.map((line) => (
                          <tr
                            key={`${section.grupo1}-${line.grupo3}`}
                            className="border-b border-slate-50 hover:bg-slate-50/60"
                          >
                            <td className="sticky left-0 bg-white py-2 pl-10 pr-4 text-slate-600">
                              {line.grupo3}
                            </td>
                            {data.periodos.map((periodo) => (
                              <td
                                key={periodo}
                                className={`px-3 py-2 text-right ${getEerrValueTone(
                                  line.tipo,
                                  line.porPeriodo[periodo] ?? 0
                                )}`}
                              >
                                {line.porPeriodo[periodo] !== undefined
                                  ? formatUf(line.porPeriodo[periodo])
                                  : "—"}
                              </td>
                            ))}
                            <td
                              className={`px-3 py-2 text-right font-medium ${getEerrValueTone(
                                line.tipo,
                                line.total
                              )}`}
                            >
                              {formatUf(line.total)}
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                ))}

                <tr className="border-t-2 border-slate-300 bg-brand-700/5">
                  <td className="sticky left-0 bg-inherit px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-800">
                    EBITDA
                  </td>
                  {data.periodos.map((periodo) => {
                    const value = data.ebitda.porPeriodo[periodo] ?? 0;
                    return (
                      <td
                        key={periodo}
                        className={`px-3 py-3 text-right text-sm font-bold ${
                          value >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {formatUf(value)}
                      </td>
                    );
                  })}
                  <td
                    className={`px-3 py-3 text-right text-sm font-bold ${
                      data.ebitda.total >= 0 ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {formatUf(data.ebitda.total)}
                  </td>
                </tr>

                {data.secciones.some((section) => section.tipo === "ingreso") ? (
                  <tr className="bg-brand-700/5">
                    <td className="sticky left-0 bg-inherit px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mg EBITDA (%)
                    </td>
                    {data.periodos.map((periodo) => {
                      const ingresos = data.secciones
                        .filter((section) => section.tipo === "ingreso")
                        .reduce((acc, section) => acc + (section.porPeriodo[periodo] ?? 0), 0);
                      const margin = calculateEbitdaMargin(
                        ingresos,
                        data.ebitda.porPeriodo[periodo] ?? 0
                      );

                      return (
                        <td
                          key={periodo}
                          className={`px-3 py-2 text-right text-xs font-semibold ${
                            margin !== null && margin >= 0 ? "text-emerald-600" : "text-red-500"
                          }`}
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
