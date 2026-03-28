"use client";

import { useMemo, useState } from "react";
import {
  CONTRACT_EXPIRY_ROW_LIMIT,
  CONTRACT_EXPIRY_WINDOWS,
  formatShortDate,
  type ContractExpiryBuckets,
  type ExpiryWindow
} from "@/lib/kpi";
import { cn } from "@/lib/utils";

type ContractExpiryTableProps = {
  rowsByWindow: ContractExpiryBuckets;
};

const windows: readonly ExpiryWindow[] = CONTRACT_EXPIRY_WINDOWS;

export function ContractExpiryTable({ rowsByWindow }: ContractExpiryTableProps): JSX.Element {
  const [activeWindow, setActiveWindow] = useState<ExpiryWindow>(CONTRACT_EXPIRY_WINDOWS[0]);
  const rows = useMemo(
    () => rowsByWindow[activeWindow].slice(0, CONTRACT_EXPIRY_ROW_LIMIT),
    [activeWindow, rowsByWindow]
  );

  return (
    <section className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-brand-700">Contratos por vencer</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {windows.map((expiryWindow) => (
            <button
              key={expiryWindow}
              type="button"
              onClick={() => setActiveWindow(expiryWindow)}
              className={cn(
                "border-b-2 bg-transparent px-4 py-2 text-sm",
                activeWindow === expiryWindow
                  ? "border-gold-400 font-semibold text-brand-700"
                  : "border-transparent font-medium text-slate-500 hover:text-brand-700"
              )}
            >
              {expiryWindow} días ({rowsByWindow[expiryWindow].length})
            </button>
          ))}
        </div>
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
                Número Contrato
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Fecha Término
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/70">
                Días Restantes
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No hay contratos por vencer en esta ventana.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
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
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.diasRestantes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
