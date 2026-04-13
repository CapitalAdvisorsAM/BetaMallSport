"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { TenantProfileHeader } from "@/components/tenant-360/TenantProfileHeader";
import { TenantKpiRow } from "@/components/tenant-360/TenantKpiRow";
import { FinancialTimelineChart } from "@/components/tenant-360/FinancialTimelineChart";
import { FacturacionPerM2Chart } from "@/components/tenant-360/FacturacionPerM2Chart";
import { ContractDetailsSection } from "@/components/tenant-360/ContractDetailsSection";
import { BillingBreakdownSection } from "@/components/tenant-360/BillingBreakdownSection";
import { SalesPerformanceSection } from "@/components/tenant-360/SalesPerformanceSection";
import { OccupancyTimeline } from "@/components/tenant-360/OccupancyTimeline";
import { ProjectionsSection } from "@/components/tenant-360/ProjectionsSection";
import { PeerComparisonSection } from "@/components/tenant-360/PeerComparisonSection";
import type { Tenant360Data } from "@/types/tenant-360";
import type { ProjectOption } from "@/types/finance";

type Tenant360ClientProps = {
  tenantId: string;
  projects: ProjectOption[];
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return fallback;
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function Tenant360Client({
  tenantId,
  projects,
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Tenant360ClientProps): JSX.Element {
  const router = useRouter();
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<Tenant360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const response = await fetch(`/api/finance/tenants/${tenantId}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Error al cargar datos del arrendatario."));
      }
      const payload = (await response.json()) as Tenant360Data;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const periods = useMemo(() => {
    if (!data) return [];
    return data.monthlyTimeline.map((p) => p.period);
  }, [data]);

  return (
    <main className="space-y-6">
      <ModuleHeader
        title="Detalle Arrendatario"
        description="Vista 360 del arrendatario: contratos, facturacion, ventas y proyecciones."
        projects={projects}
        selectedProjectId={selectedProjectId}
        preserve={{ desde, hasta }}
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              &larr; Volver
            </button>
            <ProjectPeriodToolbar
              desde={desde}
              hasta={hasta}
              onDesdeChange={setDesde}
              onHastaChange={setHasta}
            />
          </div>
        }
      />

      {loading ? (
        <ModuleLoadingState />
      ) : error ? (
        <ModuleEmptyState message={error} />
      ) : !data ? (
        <ModuleEmptyState message="No se encontraron datos para este arrendatario." />
      ) : (
        <>
          <TenantProfileHeader profile={data.profile} quickStats={data.quickStats} />
          <TenantKpiRow kpis={data.kpis} peerComparison={data.peerComparison} />
          <FinancialTimelineChart data={data.monthlyTimeline} />
          <FacturacionPerM2Chart monthlyData={data.monthlyTimeline} salesData={data.salesPerformance} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ContractDetailsSection contracts={data.contracts} />
            <SalesPerformanceSection data={data.salesPerformance} />
          </div>

          <BillingBreakdownSection data={data.billingBreakdown} periods={periods} totalLeasedM2={data.quickStats.totalLeasedM2} />
          {data.peerComparison && <PeerComparisonSection data={data.peerComparison} />}
          <OccupancyTimeline days={data.occupancyDays} />
          <ProjectionsSection projections={data.projections} gapAnalysis={data.gapAnalysis} />
        </>
      )}
    </main>
  );
}
