"use client";

import { formatDecimal } from "@/lib/utils";
import type { PeerComparison } from "@/types/tenant-360";

type PeerComparisonSectionProps = {
  data: PeerComparison;
};

export function PeerComparisonSection({ data }: PeerComparisonSectionProps): JSX.Element {
  const diffFacturacion = data.currentFacturacionUfM2 - data.avgFacturacionUfM2;
  const diffVentas = data.currentVentasPesosM2 - data.avgVentasPesosM2;

  return (
    <section className="rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-brand-700">
          Comparacion con pares — {data.categoria}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {data.peerCount} arrendatario{data.peerCount !== 1 ? "s" : ""} en la misma categoria.
        </p>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-3">
        <MetricCard
          label="Facturacion mensual (UF/m²)"
          current={data.currentFacturacionUfM2}
          average={data.avgFacturacionUfM2}
          diff={diffFacturacion}
          higherIsBetter={false}
        />
        <MetricCard
          label="Ventas mensual (UF/m²)"
          current={data.currentVentasPesosM2}
          average={data.avgVentasPesosM2}
          diff={diffVentas}
          higherIsBetter={true}
        />
        <MetricCard
          label="Costo Ocupacion (%)"
          current={data.currentCostoOcupacionPct}
          average={data.avgCostoOcupacionPct}
          diff={
            data.currentCostoOcupacionPct !== null && data.avgCostoOcupacionPct !== null
              ? data.currentCostoOcupacionPct - data.avgCostoOcupacionPct
              : null
          }
          higherIsBetter={false}
          suffix="%"
        />
      </div>

      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <th className="px-3 py-2">Arrendatario</th>
              <th className="px-3 py-2 text-right">GLA (m²)</th>
              <th className="px-3 py-2 text-right">Facturacion mensual (UF/m²)</th>
              <th className="px-3 py-2 text-right">Ventas mensual (UF/m²)</th>
              <th className="px-3 py-2 text-right">Costo Ocupacion</th>
            </tr>
          </thead>
          <tbody>
            {data.peers.map((peer) => (
              <tr
                key={peer.tenantName}
                className={`border-b border-slate-100 ${peer.isCurrent ? "bg-brand-50 font-semibold" : "hover:bg-slate-50"}`}
              >
                <td className="px-3 py-2 whitespace-nowrap">
                  {peer.tenantName}
                  {peer.isCurrent && (
                    <span className="ml-2 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                      Actual
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatDecimal(peer.glam2)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatDecimal(peer.facturacionUfM2)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {formatDecimal(peer.ventasPesosM2)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {peer.costoOcupacionPct !== null ? `${formatDecimal(peer.costoOcupacionPct)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  current,
  average,
  diff,
  higherIsBetter,
  suffix = ""
}: {
  label: string;
  current: number | null;
  average: number | null;
  diff: number | null;
  higherIsBetter: boolean;
  suffix?: string;
}): JSX.Element {
  const isPositive = diff !== null && ((higherIsBetter && diff > 0) || (!higherIsBetter && diff < 0));
  const diffColor = diff === null ? "text-slate-400" : isPositive ? "text-emerald-600" : "text-rose-600";
  const diffSign = diff !== null && diff > 0 ? "+" : "";

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800">
        {current !== null ? `${formatDecimal(current)}${suffix}` : "—"}
      </p>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          Promedio pares: {average !== null ? `${formatDecimal(average)}${suffix}` : "—"}
        </span>
        {diff !== null && (
          <span className={`font-semibold ${diffColor}`}>
            {diffSign}{formatDecimal(diff)}{suffix}
          </span>
        )}
      </div>
    </div>
  );
}
