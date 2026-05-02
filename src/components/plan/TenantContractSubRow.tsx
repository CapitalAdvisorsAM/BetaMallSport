"use client";

import Link from "next/link";
import { formatDateString } from "@/lib/utils";

export type ContractDetail = {
  id: string;
  numeroContrato: string;
  fechaInicio: string;
  fechaTermino: string | null;
  local: { codigo: string; nombre: string } | null;
  diasGracia: number;
  codigoCC: string | null;
  pctFondoPromocion: number | null;
  multiplicadorJunio: number | null;
  multiplicadorJulio: number | null;
  multiplicadorAgosto: number | null;
  multiplicadorDiciembre: number | null;
};

type TenantContractSubRowProps = {
  contratos: ContractDetail[];
};

function fmt(value: number | null, suffix: string): string {
  return value !== null ? `${value}${suffix}` : "—";
}

export function TenantContractSubRow({ contratos }: TenantContractSubRowProps): JSX.Element {
  if (contratos.length === 0) {
    return (
      <p className="py-2 text-xs italic text-slate-400">Sin contratos activos en este período.</p>
    );
  }

  return (
    <div className="py-1.5 pl-7 space-y-3">
      {contratos.map((c) => (
        <div key={c.id} className="border-b border-slate-50 pb-3 last:border-0 last:pb-0">
          {/* Summary row */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[11px]">
            <Link
              href={`/plan/contracts/${c.id}`}
              className="font-mono text-[11px] font-medium text-brand-500 underline underline-offset-2 transition-colors hover:text-brand-700"
            >
              {c.numeroContrato}
            </Link>
            <span className="text-slate-700">
              {c.local ? `${c.local.codigo} — ${c.local.nombre}` : "—"}
            </span>
            <span className="tabular-nums text-slate-500">
              {formatDateString(c.fechaInicio)} → {c.fechaTermino ? formatDateString(c.fechaTermino) : "—"}
            </span>
          </div>
          {/* Condiciones comerciales */}
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[10px]">
            <span>
              <span className="text-slate-400">Gracia</span>{" "}
              <span className="tabular-nums text-slate-600">{c.diasGracia}d</span>
            </span>
            <span>
              <span className="text-slate-400">Fondo prom.</span>{" "}
              <span className="tabular-nums text-slate-600">{fmt(c.pctFondoPromocion, "%")}</span>
            </span>
            <span>
              <span className="text-slate-400">CC</span>{" "}
              <span className="text-slate-600">{c.codigoCC ?? "—"}</span>
            </span>
            <span>
              <span className="text-slate-400">Mult. jun.</span>{" "}
              <span className="tabular-nums text-slate-600">{fmt(c.multiplicadorJunio, "x")}</span>
            </span>
            <span>
              <span className="text-slate-400">Mult. jul.</span>{" "}
              <span className="tabular-nums text-slate-600">{fmt(c.multiplicadorJulio, "x")}</span>
            </span>
            <span>
              <span className="text-slate-400">Mult. ago.</span>{" "}
              <span className="tabular-nums text-slate-600">{fmt(c.multiplicadorAgosto, "x")}</span>
            </span>
            <span>
              <span className="text-slate-400">Mult. dic.</span>{" "}
              <span className="tabular-nums text-slate-600">{fmt(c.multiplicadorDiciembre, "x")}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
