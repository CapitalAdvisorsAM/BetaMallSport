"use client";

import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatPercent, formatSquareMeters, formatUf } from "@/lib/utils";
import type { RentRollKpis, RentRollRow } from "@/types/rent-roll";

type RentRollKpiHeaderProps = {
  kpis: RentRollKpis;
  rows: RentRollRow[];
};

function getOcupacionAccent(pctOcupacion: number): "green" | "yellow" | "red" {
  if (pctOcupacion >= 85) {
    return "green";
  }
  if (pctOcupacion >= 70) {
    return "yellow";
  }
  return "red";
}

export function RentRollKpiHeader({ kpis, rows }: RentRollKpiHeaderProps): JSX.Element {
  const glaOcupado = rows
    .filter((row) => row.estado === "OCUPADO")
    .reduce((acc, row) => acc + row.glam2, 0);
  const glaGracia = rows
    .filter((row) => row.estado === "GRACIA")
    .reduce((acc, row) => acc + row.glam2, 0);
  const glaVacante = rows
    .filter((row) => row.estado === "VACANTE")
    .reduce((acc, row) => acc + row.glam2, 0);

  const denominator = Math.max(kpis.glaTotal, 1);
  const pctOcupado = (glaOcupado / denominator) * 100;
  const pctGracia = (glaGracia / denominator) * 100;
  const pctVacante = (glaVacante / denominator) * 100;

  return (
    <section className="space-y-3 rounded-md bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          metricId="kpi_rent_roll_header_gla_total_m2"
          title="GLA total (m2)"
          value={formatSquareMeters(kpis.glaTotal)}
          accent="slate"
        />
        <KpiCard
          metricId="kpi_rent_roll_header_ocupacion_pct"
          title="% ocupacion"
          value={formatPercent(kpis.pctOcupacion)}
          subtitle={`GLA ocupada: ${formatSquareMeters(kpis.glaCupado)}`}
          accent={getOcupacionAccent(kpis.pctOcupacion)}
        />
        <KpiCard
          metricId="kpi_rent_roll_header_renta_fija_mes_uf"
          title="Renta fija mes (UF)"
          value={formatUf(kpis.rentaFijaTotalUf)}
          subtitle="Solo locales ocupados"
          accent="slate"
        />
        <KpiCard
          metricId="kpi_rent_roll_header_ggcc_mes_uf"
          title="GGCC mes (UF)"
          value={formatUf(kpis.ggccTotalUf)}
          accent="slate"
        />
      </div>

      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-600">
          <span>Distribucion operacional por GLA</span>
          <span>
            Ocupado {formatPercent(pctOcupado)} | Gracia {formatPercent(pctGracia)} | Vacante{" "}
            {formatPercent(pctVacante)}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-full w-full">
            <div className="h-full bg-emerald-500" style={{ width: `${pctOcupado}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${pctGracia}%` }} />
            <div className="h-full bg-slate-300" style={{ width: `${pctVacante}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
