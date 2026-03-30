"use client";

import { cn } from "@/lib/utils";

export type RentRollDashboardTableRow = {
  id: string;
  local: string;
  arrendatario: string;
  glam2: number;
  tarifaUfM2: number;
  rentaFijaUf: number;
  ggccUf: number;
  ventasUf: number | null;
};

type RentRollDashboardTableProps = {
  rows: RentRollDashboardTableRow[];
  totals: {
    glam2: number;
    rentaFijaUf: number;
    ggccUf: number;
    ventasUf: number;
  };
};

function formatDecimal(value: number): string {
  return value.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function RentRollDashboardTable({
  rows,
  totals
}: RentRollDashboardTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No hay contratos ocupados o en gracia para el periodo seleccionado.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-brand-700">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Local
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Arrendatario
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                GLA m2
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                Tarifa UF/m2/mes
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                Renta Fija (UF)
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                GGCC (UF)
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                Ventas (UF)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  "transition-colors hover:bg-brand-50",
                  index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                )}
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.local}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.arrendatario}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatDecimal(row.glam2)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatDecimal(row.tarifaUfM2)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatDecimal(row.rentaFijaUf)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatDecimal(row.ggccUf)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {row.ventasUf == null ? "–" : formatDecimal(row.ventasUf)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-brand-50 font-semibold text-slate-900">
              <td className="px-4 py-3" colSpan={2}>
                Totales
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">{formatDecimal(totals.glam2)}</td>
              <td className="px-4 py-3" />
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.rentaFijaUf)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">{formatDecimal(totals.ggccUf)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">{formatDecimal(totals.ventasUf)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

