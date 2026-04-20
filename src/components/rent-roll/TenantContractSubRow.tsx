"use client";

import Link from "next/link";
import { formatDateString } from "@/lib/utils";

export type ContractDetail = {
  id: string;
  numeroContrato: string;
  fechaInicio: string;
  fechaTermino: string | null;
  local: { codigo: string; nombre: string } | null;
};

type TenantContractSubRowProps = {
  contratos: ContractDetail[];
};

export function TenantContractSubRow({ contratos }: TenantContractSubRowProps): JSX.Element {
  if (contratos.length === 0) {
    return (
      <p className="py-2 text-xs italic text-slate-400">Sin contratos activos en este período.</p>
    );
  }

  return (
    <div className="py-1.5 pl-7">
      <table className="min-w-full text-[11px]">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-1.5 pr-8 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
              N° Contrato
            </th>
            <th className="pb-1.5 pr-8 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Local
            </th>
            <th className="pb-1.5 pr-8 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Inicio
            </th>
            <th className="pb-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Término
            </th>
          </tr>
        </thead>
        <tbody>
          {contratos.map((c) => (
            <tr key={c.id} className="border-b border-slate-50 last:border-0">
              <td className="py-1.5 pr-8">
                <Link
                  href={`/rent-roll/contracts/${c.id}`}
                  className="font-mono text-[11px] text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
                >
                  {c.numeroContrato}
                </Link>
              </td>
              <td className="py-1.5 pr-8 text-slate-700">
                {c.local ? `${c.local.codigo} — ${c.local.nombre}` : "—"}
              </td>
              <td className="py-1.5 pr-8 tabular-nums text-slate-500">
                {formatDateString(c.fechaInicio)}
              </td>
              <td className="py-1.5 tabular-nums text-slate-500">
                {c.fechaTermino ? formatDateString(c.fechaTermino) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
