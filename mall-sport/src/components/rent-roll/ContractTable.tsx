import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Local</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Arrendatario</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Fecha inicio</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Fecha termino</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Tarifa vigente (UF/m²)
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">m²</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
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
