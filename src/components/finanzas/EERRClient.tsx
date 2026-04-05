"use client";

import { useCallback, useEffect, useState } from "react";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { EERRTable } from "@/components/finanzas/EERRTable";
import { Button } from "@/components/ui/button";
import { buildExportExcelUrl } from "@/lib/export/shared";
import type { EerrData, ProjectOption } from "@/types/finanzas";

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
        showProjectSelector={false}
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
          <EERRTable
            data={data}
            expandedSections={expandedSections}
            onToggleSection={toggleSection}
          />
        )}
      </ModuleSectionCard>
    </main>
  );
}
