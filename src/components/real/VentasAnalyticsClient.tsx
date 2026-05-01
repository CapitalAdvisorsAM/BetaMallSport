"use client";

import { useCallback, useEffect, useState } from "react";
import { ModuleHeader } from "@/components/dashboard/ModuleHeader";
import { ProjectPeriodToolbar } from "@/components/dashboard/ProjectPeriodToolbar";
import { VentasKpiStrip } from "@/components/real/sales/VentasKpiStrip";
import { VentasMensualTab } from "@/components/real/sales/VentasMensualTab";
import { VentasCruceTab } from "@/components/real/sales/VentasCruceTab";
import { VentasTopTenantsTab } from "@/components/real/sales/VentasTopTenantsTab";
import { cn } from "@/lib/utils";
import type { VentasKpisResponse } from "@/types/sales-analytics";

type Tab = "mensual" | "cruce" | "top";

const TAB_LABELS: Record<Tab, string> = {
  mensual: "Mensual",
  cruce: "Cruce",
  top: "Top Tenants"
};

const TAB_ORDER: Tab[] = ["mensual", "cruce", "top"];

type Props = {
  selectedProjectId: string;
  defaultDesde?: string;
  defaultHasta?: string;
};

export function VentasAnalyticsClient({
  selectedProjectId,
  defaultDesde,
  defaultHasta
}: Props): JSX.Element {
  const [desde, setDesde] = useState(defaultDesde ?? "");
  const [hasta, setHasta] = useState(defaultHasta ?? "");
  const [activeTab, setActiveTab] = useState<Tab>("mensual");
  const [kpis, setKpis] = useState<VentasKpisResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        mode: "kpis"
      });
      if (desde) params.set("from", desde);
      if (hasta) params.set("to", hasta);
      const res = await fetch(`/api/real/sales-analytics?${params}`);
      if (res.ok) {
        const json = (await res.json()) as VentasKpisResponse;
        if (json.mode === "kpis") setKpis(json);
      }
    } finally {
      setKpisLoading(false);
    }
  }, [selectedProjectId, desde, hasta]);

  useEffect(() => {
    void fetchKpis();
  }, [fetchKpis]);

  return (
    <main className="space-y-4">
      <ModuleHeader
        title="Ventas Mensuales (UF/m²)"
        description="Ventas por dimensión de local. Replica la hoja 'Ventas' del CDG."
        actions={
          <ProjectPeriodToolbar
            desde={desde}
            hasta={hasta}
            onDesdeChange={setDesde}
            onHastaChange={setHasta}
          />
        }
      />

      <VentasKpiStrip data={kpis} loading={kpisLoading} />

      <div className="flex flex-wrap items-center gap-1 border-b border-surface-200">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === t
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 hover:text-brand-700"
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {activeTab === "mensual" ? (
        <VentasMensualTab selectedProjectId={selectedProjectId} desde={desde} hasta={hasta} />
      ) : null}
      {activeTab === "cruce" ? (
        <VentasCruceTab selectedProjectId={selectedProjectId} desde={desde} hasta={hasta} />
      ) : null}
      {activeTab === "top" ? (
        <VentasTopTenantsTab selectedProjectId={selectedProjectId} desde={desde} hasta={hasta} />
      ) : null}
    </main>
  );
}
