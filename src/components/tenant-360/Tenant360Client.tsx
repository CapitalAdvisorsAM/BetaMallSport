"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { KpiCard } from "@/components/dashboard/KpiCard";
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
import { SalesYoYChart } from "@/components/tenant-360/SalesYoYChart";
import { SalesSeasonalityChart } from "@/components/tenant-360/SalesSeasonalityChart";
import { SalesBudgetVsActualSection } from "@/components/tenant-360/SalesBudgetVsActualSection";
import { RentCompositionChart } from "@/components/tenant-360/RentCompositionChart";
import { BillingRealizationSection } from "@/components/tenant-360/BillingRealizationSection";
import { cn, formatUf, formatPercent } from "@/lib/utils";
import type { Tenant360Data, Tenant360SalesPoint } from "@/types/tenant-360";

type Tenant360ClientProps = {
  tenantId: string;
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

type TabId = "resumen" | "ventas" | "presupuesto" | "facturacion" | "contratos" | "analisis";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen",      label: "Resumen" },
  { id: "ventas",       label: "Ventas" },
  { id: "presupuesto",  label: "Presupuesto" },
  { id: "facturacion",  label: "Facturacion" },
  { id: "contratos",    label: "Contratos & Ocupacion" },
  { id: "analisis",     label: "Analisis & Proyecciones" },
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

// ── Sales KPI row — shown at top of Ventas tab ─────────────────────────────

type SalesKpiRowProps = { data: Tenant360SalesPoint[] };

function SalesKpiRow({ data }: SalesKpiRowProps): JSX.Element {
  const metrics = useMemo(() => {
    if (data.length === 0) return null;

    const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));
    const currentYear = new Date().getFullYear().toString();
    const prevYear = (new Date().getFullYear() - 1).toString();

    const peak = sorted.reduce((best, p) => p.salesUf > best.salesUf ? p : best, sorted[0]);

    const last12 = sorted.slice(-12);
    const prior12 = sorted.slice(-24, -12);
    const last12Sum = last12.reduce((s, p) => s + p.salesUf, 0);
    const prior12Sum = prior12.reduce((s, p) => s + p.salesUf, 0);
    const yoyGrowthPct = prior12Sum > 0 ? ((last12Sum - prior12Sum) / prior12Sum) * 100 : null;

    const salesValues = sorted.map((p) => p.salesUf).filter((v) => v > 0);
    let cvPct: number | null = null;
    if (salesValues.length >= 3) {
      const mean = salesValues.reduce((a, b) => a + b, 0) / salesValues.length;
      const variance = salesValues.reduce((s, v) => s + (v - mean) ** 2, 0) / salesValues.length;
      cvPct = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : null;
    }

    const variableRentTotal = sorted.reduce((s, p) => s + p.variableRentUf, 0);
    const ytdUf = sorted.filter((p) => p.period.startsWith(currentYear)).reduce((s, p) => s + p.salesUf, 0);
    const prevYtdUf = sorted.filter((p) => p.period.startsWith(prevYear)).reduce((s, p) => s + p.salesUf, 0);

    return { peak, yoyGrowthPct, cvPct, variableRentTotal, ytdUf, prevYtdUf };
  }, [data]);

  if (!metrics) return <></>;

  const { peak, yoyGrowthPct, cvPct, variableRentTotal, ytdUf, prevYtdUf } = metrics;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        title="Mes Pico de Ventas"
        value={`${formatUf(peak.salesUf)} UF`}
        subtitle={peak.period}
        accent="slate"
      />
      <KpiCard
        title="Crecimiento YoY"
        value={yoyGrowthPct !== null ? formatPercent(yoyGrowthPct, 1) : "—"}
        subtitle="Ultimos 12m vs 12m anteriores"
        accent={
          yoyGrowthPct === null ? "slate"
          : yoyGrowthPct > 5 ? "green"
          : yoyGrowthPct < -5 ? "red"
          : "yellow"
        }
        trend={yoyGrowthPct !== null ? { value: yoyGrowthPct, label: "interanual" } : undefined}
      />
      <KpiCard
        title="Variabilidad Ventas"
        value={cvPct !== null ? `${cvPct.toFixed(1)}%` : "—"}
        subtitle="Coef. de variacion (menor = mas estable)"
        accent={
          cvPct === null ? "slate"
          : cvPct < 20 ? "green"
          : cvPct < 40 ? "yellow"
          : "red"
        }
      />
      <KpiCard
        title="Renta Variable Total"
        value={variableRentTotal > 0 ? `${formatUf(variableRentTotal)} UF` : "—"}
        subtitle="Acumulada en el periodo"
        accent="slate"
      />
      <KpiCard
        title="Ventas YTD"
        value={ytdUf > 0 ? `${formatUf(ytdUf)} UF` : "—"}
        subtitle={`Acumulado ${new Date().getFullYear()}`}
        accent="slate"
      />
      <KpiCard
        title="Ventas Año Anterior"
        value={prevYtdUf > 0 ? `${formatUf(prevYtdUf)} UF` : "—"}
        subtitle={`Total ${new Date().getFullYear() - 1}`}
        accent="slate"
      />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function Tenant360Client({
  tenantId,
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
  const [activeTab, setActiveTab] = useState<TabId>("resumen");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId: selectedProjectId });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const response = await fetch(`/api/real/tenants/${tenantId}?${params.toString()}`);
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
        actions={
          <div className="flex items-center gap-3">
            <Breadcrumb items={[
              { label: "Arrendatarios", href: "/plan/tenants" },
              { label: data?.profile?.nombreComercial ?? "Detalle" },
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
        <ModuleEmptyState message="No se encontraron datos para este arrendatario." />
      ) : (
        <>
          {/* Profile always visible above tabs */}
          <TenantProfileHeader profile={data.profile} quickStats={data.quickStats} />

          {/* Tab navigation */}
          <nav className="flex gap-1 overflow-x-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "whitespace-nowrap rounded px-4 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-brand-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab: Resumen */}
          {activeTab === "resumen" && (
            <div className="space-y-6">
              <TenantKpiRow
                kpis={data.kpis}
                peerComparison={data.peerComparison}
                gapAnalysis={data.gapAnalysis}
                salesPerformance={data.salesPerformance}
              />
              <FinancialTimelineChart data={data.monthlyTimeline} />
              <FacturacionPerM2Chart monthlyData={data.monthlyTimeline} salesData={data.salesPerformance} />
            </div>
          )}

          {/* Tab: Ventas */}
          {activeTab === "ventas" && (
            <div className="space-y-6">
              <SalesKpiRow data={data.salesPerformance} />
              <SalesPerformanceSection data={data.salesPerformance} />
              <SalesYoYChart data={data.salesPerformance} />
              <SalesSeasonalityChart data={data.salesPerformance} />
            </div>
          )}

          {/* Tab: Presupuesto */}
          {activeTab === "presupuesto" && (
            <div className="space-y-6">
              <SalesBudgetVsActualSection data={data.budgetVsActual} />
            </div>
          )}

          {/* Tab: Facturacion */}
          {activeTab === "facturacion" && (
            <div className="space-y-6">
              <BillingRealizationSection gapAnalysis={data.gapAnalysis} />
              <FacturacionPerM2Chart monthlyData={data.monthlyTimeline} salesData={data.salesPerformance} />
              <BillingBreakdownSection data={data.billingBreakdown} periods={periods} totalLeasedM2={data.quickStats.totalLeasedM2} />
            </div>
          )}

          {/* Tab: Contratos & Ocupacion */}
          {activeTab === "contratos" && (
            <div className="space-y-6">
              <ContractDetailsSection contracts={data.contracts} />
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <RentCompositionChart contracts={data.contracts} />
                <OccupancyTimeline days={data.occupancyDays} />
              </div>
            </div>
          )}

          {/* Tab: Analisis & Proyecciones */}
          {activeTab === "analisis" && (
            <div className="space-y-6">
              {data.peerComparison && <PeerComparisonSection data={data.peerComparison} />}
              <ProjectionsSection projections={data.projections} gapAnalysis={data.gapAnalysis} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
