"use client";

import { useMemo, useState } from "react";
import { formatShortDate, type ContractExpiryBuckets } from "@/lib/kpi";
import { cn } from "@/lib/utils";

type ExpiryWindow = 30 | 60 | 90;

type ContractExpiryTableProps = {
  rowsByWindow: ContractExpiryBuckets;
};

const windows: ExpiryWindow[] = [30, 60, 90];

export function ContractExpiryTable({ rowsByWindow }: ContractExpiryTableProps): JSX.Element {
  const [activeWindow, setActiveWindow] = useState<ExpiryWindow>(30);
  const rows = useMemo(() => rowsByWindow[activeWindow], [activeWindow, rowsByWindow]);

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-slate-900">Contratos por vencer</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {windows.map((window) => (
            <button
              key={window}
              type="button"
              onClick={() => setActiveWindow(window)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium",
                activeWindow === window
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              {window} d\u00edas ({rowsByWindow[window].length})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left font-medium text-slate-600">
              <th className="px-4 py-3">Local</th>
              <th className="px-4 py-3">Arrendatario</th>
              <th className="px-4 py-3">N\u00b0 Contrato</th>
              <th className="px-4 py-3">Fecha t\u00e9rmino</th>
              <th className="px-4 py-3">D\u00edas restantes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No hay contratos por vencer en esta ventana.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
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
