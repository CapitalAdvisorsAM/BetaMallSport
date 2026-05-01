"use client";

import { useMemo } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatClp, formatPercent, formatUf } from "@/lib/utils";
import type { Tenant360Kpis, PeerComparison, GapAnalysisRow, Tenant360SalesPoint } from "@/types/tenant-360";

type TenantKpiRowProps = {
  kpis: Tenant360Kpis;
  peerComparison?: PeerComparison | null;
  gapAnalysis?: GapAnalysisRow[];
  salesPerformance?: Tenant360SalesPoint[];
};

function formatPctOrDash(value: number | null): string {
  if (value === null) return "—";
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

function computeGapMetrics(rows: GapAnalysisRow[]) {
  const active = rows.filter((r) => r.expectedBillingUf > 0);
  if (active.length === 0) return { realizationPct: null, cumulativeGap: null };

  const realizationValues = active
    .map((r) => (r.actualBillingUf / r.expectedBillingUf) * 100)
    .filter(isFinite);

  const realizationPct = realizationValues.length > 0
    ? realizationValues.reduce((a, b) => a + b, 0) / realizationValues.length
    : null;

  const cumulativeGap = active.reduce((s, r) => s + r.gapUf, 0);
  return { realizationPct, cumulativeGap };
}

function computeSalesMetrics(points: Tenant360SalesPoint[]) {
  if (points.length === 0) return { momGrowthPct: null, salesYtdUf: null, salesSparkline: [] };

  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const currentYear = new Date().getFullYear().toString();
  const salesYtdUf = sorted
    .filter((p) => p.period.startsWith(currentYear))
    .reduce((s, p) => s + p.salesUf, 0);

  const salesSparkline = sorted.slice(-12).map((p) => p.salesUf);

  let momGrowthPct: number | null = null;
  if (sorted.length >= 2) {
    const last = sorted[sorted.length - 1].salesUf;
    const prev = sorted[sorted.length - 2].salesUf;
    if (prev > 0) momGrowthPct = ((last - prev) / prev) * 100;
  }

  return { momGrowthPct, salesYtdUf, salesSparkline };
}

function realizationAccent(pct: number | null): "green" | "yellow" | "red" | "slate" {
  if (pct === null) return "slate";
  if (pct >= 95) return "green";
  if (pct >= 85) return "yellow";
  return "red";
}

export function TenantKpiRow({ kpis, peerComparison, gapAnalysis = [], salesPerformance = [] }: TenantKpiRowProps): JSX.Element {
  const peer = peerComparison ?? null;

  const { realizationPct, cumulativeGap } = useMemo(
    () => computeGapMetrics(gapAnalysis),
    [gapAnalysis]
  );

  const { momGrowthPct, salesYtdUf, salesSparkline } = useMemo(
    () => computeSalesMetrics(salesPerformance),
    [salesPerformance]
  );

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
      {/* Row 1 — Operational */}
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
        value={kpis.facturacionUfM2 !== null ? `${formatUf(kpis.facturacionUfM2)} UF/m²` : "—"}
        subtitle={benchmarkSubtitle(kpis.facturacionUfM2, peer?.avgFacturacionUfM2 ?? null, "UF/m²")}
        accent="slate"
      />
      <KpiCard
        metricId="kpi_tenant360_ventas_uf_m2"
        title="Ventas (UF/m²)"
        value={kpis.ventasPesosM2 !== null ? `${formatUf(kpis.ventasPesosM2)} UF/m²` : "—"}
        subtitle={benchmarkSubtitle(kpis.ventasPesosM2, peer?.avgVentasPesosM2 ?? null, "UF/m²")}
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

      {/* Row 2 — Financial health */}
      <KpiCard
        metricId="kpi_tenant360_ggcc_estimado_uf"
        title="GGCC Estimado"
        value={`${formatUf(kpis.ggccEstimadoUf)} UF`}
        accent="slate"
      />
      <KpiCard
        metricId="kpi_tenant360_ventas_promedio_uf"
        title="Ventas Prom/Mes"
        value={`${formatUf(kpis.ventasPromedioMensualPesos)} UF`}
        accent="slate"
        sparkline={salesSparkline.length >= 2 ? salesSparkline : undefined}
      />
      <KpiCard
        title="Realizacion Facturacion"
        value={realizationPct !== null ? formatPercent(realizationPct) : "—"}
        subtitle="Facturado / Esperado (prom.)"
        accent={realizationAccent(realizationPct)}
      />
      <KpiCard
        title="Brecha Acumulada"
        value={
          cumulativeGap !== null
            ? `${cumulativeGap >= 0 ? "+" : ""}${formatUf(cumulativeGap)} UF`
            : "—"
        }
        subtitle="Suma facturado - esperado"
        accent={
          cumulativeGap === null ? "slate"
          : cumulativeGap > 0.5 ? "red"
          : cumulativeGap < -0.5 ? "green"
          : "slate"
        }
      />
      <KpiCard
        title="Crecim. Ventas MoM"
        value={momGrowthPct !== null ? formatPercent(momGrowthPct, 1) : "—"}
        subtitle="Variacion mensual ultimo periodo"
        accent={
          momGrowthPct === null ? "slate"
          : momGrowthPct > 5 ? "green"
          : momGrowthPct < -5 ? "red"
          : "yellow"
        }
        trend={momGrowthPct !== null ? { value: momGrowthPct, label: "vs mes anterior" } : undefined}
      />
      <KpiCard
        title="Ventas YTD"
        value={salesYtdUf !== null && salesYtdUf > 0 ? `${formatUf(salesYtdUf)} UF` : "—"}
        subtitle={`Acumulado ${new Date().getFullYear()}`}
        accent="slate"
      />
    </div>
  );
}
