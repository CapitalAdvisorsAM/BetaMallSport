import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatDate } from "@/lib/utils";
import type { RentRollRow } from "@/types";

type ContractTableProps = {
  rows: RentRollRow[];
};

export function ContractTable({ rows }: ContractTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No hay contratos para los filtros seleccionados.
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
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Estado
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Fecha inicio
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Fecha termino
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Tarifa vigente (UF/m2)
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                m2
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
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={row.estado} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatDate(row.fechaInicio)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatDate(row.fechaTermino)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {row.tarifaVigenteUfM2}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.m2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
