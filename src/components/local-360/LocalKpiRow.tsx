"use client";

import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatPercent, formatUf } from "@/lib/utils";
import type { Local360Kpis } from "@/types/local-360";

type LocalKpiRowProps = {
  kpis: Local360Kpis;
};

function occupancyAccent(pct: number): "green" | "yellow" | "red" {
  if (pct >= 90) return "green";
  if (pct >= 70) return "yellow";
  return "red";
}

function realizationAccent(pct: number | null): "green" | "yellow" | "red" | "slate" {
  if (pct === null) return "slate";
  if (pct >= 95) return "green";
  if (pct >= 85) return "yellow";
  return "red";
}

export function LocalKpiRow({ kpis }: LocalKpiRowProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        title="Ocupación"
        value={formatPercent(kpis.occupancyPct, 1)}
        subtitle="En el rango seleccionado"
        accent={occupancyAccent(kpis.occupancyPct)}
      />
      <KpiCard
        title="Renta mensual actual"
        value={kpis.currentRentUf !== null ? `${formatUf(kpis.currentRentUf)} UF` : "—"}
        subtitle={kpis.currentRentUf === null ? "Sin contrato vigente" : "Tarifa fija vigente"}
        accent="slate"
      />
      <KpiCard
        title="Realización facturación"
        value={kpis.realizationPct !== null ? formatPercent(kpis.realizationPct, 1) : "—"}
        subtitle="Real / esperado"
        accent={realizationAccent(kpis.realizationPct)}
      />
      <KpiCard
        title="Ventas promedio UF/m²"
        value={kpis.averageSalesUfPerM2 !== null ? formatUf(kpis.averageSalesUfPerM2) : "—"}
        subtitle="Mensual por metro cuadrado"
        accent="slate"
      />
      <KpiCard
        title="Facturación total"
        value={`${formatUf(kpis.totalBillingUf)} UF`}
        subtitle="Acumulada en el rango"
        accent="slate"
      />
      <KpiCard
        title="Brecha total"
        value={`${formatUf(kpis.totalGapUf)} UF`}
        subtitle="Esperado − real"
        accent={kpis.totalGapUf > 0 ? "red" : "green"}
      />
    </div>
  );
}
