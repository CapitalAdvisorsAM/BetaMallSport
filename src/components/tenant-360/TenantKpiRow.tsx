"use client";

import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatClp, formatPercent, formatUf } from "@/lib/utils";
import type { Tenant360Kpis, PeerComparison } from "@/types/tenant-360";

type TenantKpiRowProps = {
  kpis: Tenant360Kpis;
  peerComparison?: PeerComparison | null;
};

function formatPctOrDash(value: number | null): string {
  if (value === null) return "\u2014";
  return formatPercent(value);
}

function costoAccent(pct: number | null): "green" | "yellow" | "red" {
  if (pct === null) return "green";
  if (pct < 10) return "green";
  if (pct <= 15) return "yellow";
  return "red";
}

function waltAccent(meses: number): "green" | "yellow" | "red" {
  if (meses > 24) return "green";
  if (meses >= 12) return "yellow";
  return "red";
}

function benchmarkSubtitle(current: number | null, avg: number | null, label: string): string | undefined {
  if (current === null || avg === null) return undefined;
  const diff = current - avg;
  const sign = diff > 0 ? "+" : "";
  return `Prom. pares: ${formatUf(avg)} ${label} (${sign}${formatUf(diff)})`;
}

export function TenantKpiRow({ kpis, peerComparison }: TenantKpiRowProps): JSX.Element {
  const peer = peerComparison ?? null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-4">
      <KpiCard
        metricId="kpi_tenant360_costo_ocupacion_pct"
        title="Costo Ocupacion"
        value={formatPctOrDash(kpis.costoOcupacionPct)}
        subtitle={
          peer && peer.avgCostoOcupacionPct !== null && kpis.costoOcupacionPct !== null
            ? `Prom. pares: ${formatPctOrDash(peer.avgCostoOcupacionPct)}`
            : undefined
        }
        accent={costoAccent(kpis.costoOcupacionPct)}
      />
      <KpiCard
        metricId="kpi_tenant360_facturacion_uf_m2"
        title="Facturacion (UF/m²)"
        value={kpis.facturacionUfM2 !== null ? `${formatUf(kpis.facturacionUfM2)} UF/m\u00b2` : "\u2014"}
        subtitle={benchmarkSubtitle(kpis.facturacionUfM2, peer?.avgFacturacionUfM2 ?? null, "UF/m\u00b2")}
        accent="slate"
      />
      <KpiCard
        metricId="kpi_tenant360_ventas_uf_m2"
        title="Ventas (UF/m²)"
        value={kpis.ventasUfM2 !== null ? `${formatUf(kpis.ventasUfM2)} UF/m\u00b2` : "\u2014"}
        subtitle={benchmarkSubtitle(kpis.ventasUfM2, peer?.avgVentasUfM2 ?? null, "UF/m\u00b2")}
        accent="slate"
      />
      <KpiCard
        metricId="kpi_tenant360_walt_meses"
        title="WALT"
        value={`${kpis.waltMeses.toFixed(1)} meses`}
        accent={waltAccent(kpis.waltMeses)}
      />
      <KpiCard
        metricId="kpi_tenant360_renta_fija_uf"
        title="Renta Fija (UF)"
        value={`${formatUf(kpis.rentaFijaMensualUf)} UF`}
        accent="slate"
      />
      <KpiCard
        metricId="kpi_tenant360_renta_fija_clp"
        title="Renta Fija (CLP)"
        value={formatClp(kpis.rentaFijaClp)}
        accent="slate"
      />
      <KpiCard
        metricId="kpi_tenant360_ggcc_estimado_uf"
        title="GGCC Estimado"
        value={`${formatUf(kpis.ggccEstimadoUf)} UF`}
        accent="slate"
      />
      <KpiCard
        metricId="kpi_tenant360_ventas_promedio_uf"
        title="Ventas Prom/Mes"
        value={`${formatUf(kpis.ventasPromedioMensualUf)} UF`}
        accent="slate"
      />
    </div>
  );
}
