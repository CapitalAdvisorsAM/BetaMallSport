import Link from "next/link";
import { formatShortDate, type ContractExpiryRow } from "@/lib/kpi";
import { cn } from "@/lib/utils";

type ContractExpiryTableProps = {
  rows: ContractExpiryRow[];
  proyectoId: string;
};

type UrgencyBadge = {
  className: string;
  label: string;
};

const CONTRACT_EXPIRY_EXECUTIVE_LIMIT = 5;

function getUrgencyBadge(diasRestantes: number): UrgencyBadge {
  if (diasRestantes <= 7) {
    return {
      className: "bg-rose-100 text-rose-800",
      label: "¡Vence esta semana!"
    };
  }
  if (diasRestantes <= 30) {
    return {
      className: "bg-rose-50 text-rose-700",
      label: `${diasRestantes} dias`
    };
  }
  if (diasRestantes <= 60) {
    return {
      className: "bg-amber-50 text-amber-700",
      label: `${diasRestantes} dias`
    };
  }
  return {
    className: "bg-orange-50 text-orange-700",
    label: `${diasRestantes} dias`
  };
}

export function ContractExpiryTable({ rows, proyectoId }: ContractExpiryTableProps): JSX.Element {
  const rowsSorted = [...rows].sort((left, right) => left.diasRestantes - right.diasRestantes);
  const visibleRows = rowsSorted.slice(0, CONTRACT_EXPIRY_EXECUTIVE_LIMIT);
  const totalCount = rowsSorted.length;
  const urgentCount = Math.min(totalCount, CONTRACT_EXPIRY_EXECUTIVE_LIMIT);
  const href = `/rent-roll/dashboard?proyecto=${proyectoId}`;

  return (
    <section className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-brand-700">Proximos vencimientos</h3>
        <p className="mt-1 text-sm text-slate-600">
          Los {urgentCount} mas urgentes · Actua antes para evitar vacancia
        </p>
      </div>

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
                Numero Contrato
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Fecha Termino
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Dias Restantes
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No hay contratos proximos a vencer en los proximos 90 dias.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => {
                const badge = getUrgencyBadge(row.diasRestantes);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "transition-colors hover:bg-brand-50",
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.local}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.arrendatario}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.numeroContrato}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatShortDate(row.fechaTermino)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 px-4 py-3 text-right text-sm">
        {totalCount > CONTRACT_EXPIRY_EXECUTIVE_LIMIT ? (
          <span className="mr-2 text-slate-500">
            Mostrando {CONTRACT_EXPIRY_EXECUTIVE_LIMIT} de {totalCount}.
          </span>
        ) : null}
        <Link href={href} className="text-brand-500 underline hover:text-brand-700">
          Ver todos los vencimientos en Rent Roll -&gt;
        </Link>
      </div>
    </section>
  );
}
