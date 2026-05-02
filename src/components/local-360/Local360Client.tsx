"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ModuleLoadingState } from "@/components/dashboard/ModuleLoadingState";
import { ModuleEmptyState } from "@/components/dashboard/ModuleEmptyState";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { LocalProfileHeader } from "@/components/local-360/LocalProfileHeader";
import { LocalKpiRow } from "@/components/local-360/LocalKpiRow";
import { TenantHistoryTimeline } from "@/components/local-360/TenantHistoryTimeline";
import { TenantHistoryTable } from "@/components/local-360/TenantHistoryTable";
import { EnergyCostSection } from "@/components/local-360/EnergyCostSection";
import { LocalPeerComparisonSection } from "@/components/local-360/LocalPeerComparisonSection";
import { FinancialTimelineChart } from "@/components/tenant-360/FinancialTimelineChart";
import { FacturacionPerM2Chart } from "@/components/tenant-360/FacturacionPerM2Chart";
import { BillingBreakdownSection } from "@/components/tenant-360/BillingBreakdownSection";
import { SalesPerformanceSection } from "@/components/tenant-360/SalesPerformanceSection";
import { OccupancyTimeline } from "@/components/tenant-360/OccupancyTimeline";
import { ProjectionsSection } from "@/components/tenant-360/ProjectionsSection";
import { SalesYoYChart } from "@/components/tenant-360/SalesYoYChart";
import { SalesSeasonalityChart } from "@/components/tenant-360/SalesSeasonalityChart";
import { RentCompositionChart } from "@/components/tenant-360/RentCompositionChart";
import { BillingRealizationSection } from "@/components/tenant-360/BillingRealizationSection";
import { cn } from "@/lib/utils";
import type { Local360Data } from "@/types/local-360";

type Local360ClientProps = {
  unitId: string;
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

type TabId = "resumen" | "historia" | "ventas" | "facturacion" | "analisis";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen",     label: "Resumen" },
  { id: "historia",    label: "Historia de Arrendatarios" },
  { id: "ventas",      label: "Ventas" },
  { id: "facturacion", label: "Facturación & Ocupación" },
  { id: "analisis",    label: "Análisis & Proyecciones" },
];

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

export function Local360Client({
  unitId,
  selectedProjectId,
  defaultDesde,
  defaultHasta,
}: Local360ClientProps): JSX.Element {
  const router = useRouter();
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [data, setData] = useState<Local360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("resumen");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const response = await fetch(`/api/real/units/${unitId}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Error al cargar datos del local."));
      }
      const payload = (await response.json()) as Local360Data;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }, [unitId, selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const periods = data ? data.monthlyTimeline.map((p) => p.period) : [];

  return (
    <main className="space-y-6">
      <ModuleHeader
        title="Detalle Local"
        description="Vista 360 del local: historia de arrendatarios, facturación, ventas y proyecciones."
        actions={
          <div className="flex items-center gap-3">
            <Breadcrumb items={[
              { label: "Locales", href: "/plan/units" },
              { label: data?.profile?.codigo ?? "Detalle" },
            ]} />
            <ProjectPeriodToolbar
              desde={desde}
              hasta={hasta}
              onDesdeChange={(value) => {
                setDesde(value);
                const params = new URLSearchParams(window.location.search);
                if (value) params.set("desde", value); else params.delete("desde");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
              onHastaChange={(value) => {
                setHasta(value);
                const params = new URLSearchParams(window.location.search);
                if (value) params.set("hasta", value); else params.delete("hasta");
                router.replace(`?${params.toString()}`, { scroll: false });
              }}
            />
          </div>
        }
      />

      {loading ? (
        <ModuleLoadingState />
      ) : error ? (
        <ModuleEmptyState message={error} />
      ) : !data ? (
        <ModuleEmptyState message="No se encontraron datos para este local." />
      ) : (
        <>
          <LocalProfileHeader profile={data.profile} quickStats={data.quickStats} />

          <nav className="flex gap-1 overflow-x-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "whitespace-nowrap rounded px-4 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-brand-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "resumen" && (
            <div className="space-y-6">
              <LocalKpiRow kpis={data.kpis} />
              <FinancialTimelineChart data={data.monthlyTimeline} />
              <FacturacionPerM2Chart monthlyData={data.monthlyTimeline} salesData={data.salesPerformance} />
            </div>
          )}

          {activeTab === "historia" && (
            <div className="space-y-6">
              <TenantHistoryTimeline
                history={data.tenantHistory}
                selectedProjectId={selectedProjectId}
              />
              <TenantHistoryTable
                history={data.tenantHistory}
                selectedProjectId={selectedProjectId}
              />
            </div>
          )}

          {activeTab === "ventas" && (
            <div className="space-y-6">
              <SalesPerformanceSection data={data.salesPerformance} />
              <SalesYoYChart data={data.salesPerformance} />
              <SalesSeasonalityChart data={data.salesPerformance} />
            </div>
          )}

          {activeTab === "facturacion" && (
            <div className="space-y-6">
              <BillingBreakdownSection data={data.billingBreakdown} periods={periods} totalLeasedM2={data.profile.glam2} />
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <OccupancyTimeline days={data.occupancyDays} />
                <RentCompositionChart contracts={data.contracts} />
              </div>
              <EnergyCostSection data={data.energyTimeline} />
            </div>
          )}

          {activeTab === "analisis" && (
            <div className="space-y-6">
              {data.peerComparison ? (
                <LocalPeerComparisonSection data={data.peerComparison} />
              ) : null}
              <BillingRealizationSection gapAnalysis={data.gapAnalysis} />
              <ProjectionsSection projections={data.projections} gapAnalysis={data.gapAnalysis} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
