"use client";

import { KpiCard } from "@/components/dashboard/KpiCard";
import { formatUf } from "@/lib/utils";
import type { RentRollKpis, RentRollRow } from "@/types/rent-roll";

type RentRollKpiHeaderProps = {
  kpis: RentRollKpis;
  rows: RentRollRow[];
};

function formatM2(value: number): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPct(value: number): string {
  return `${value.toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

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
        <KpiCard title="GLA total (m2)" value={formatM2(kpis.glaTotal)} accent="slate" />
        <KpiCard
          title="% ocupacion"
          value={formatPct(kpis.pctOcupacion)}
          subtitle={`GLA ocupada: ${formatM2(kpis.glaCupado)} m2`}
          accent={getOcupacionAccent(kpis.pctOcupacion)}
        />
        <KpiCard
          title="Renta fija mes (UF)"
          value={formatUf(kpis.rentaFijaTotalUf)}
          subtitle="Solo locales ocupados"
          accent="slate"
        />
        <KpiCard title="GGCC mes (UF)" value={formatUf(kpis.ggccTotalUf)} accent="slate" />
      </div>

      <div className="rounded-md border border-slate-200 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-600">
          <span>Distribucion operacional por GLA</span>
          <span>
            Ocupado {formatPct(pctOcupado)} | Gracia {formatPct(pctGracia)} | Vacante{" "}
            {formatPct(pctVacante)}
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
