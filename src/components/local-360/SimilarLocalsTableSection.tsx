"use client";

import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import {
  cn,
  formatPercent,
  formatUf,
  formatUfPerM2,
} from "@/lib/utils";
import type { SimilarLocalRow, SimilarLocalsTable } from "@/types/local-360";

type Props = {
  data: SimilarLocalsTable;
};

export function SimilarLocalsTableSection({ data }: Props): JSX.Element {
  const filterChips = [
    data.filterTamano ? `Tamaño: ${data.filterTamano}` : null,
    `Tipo: ${data.filterTipo}`,
    data.filterPiso ? `Piso: ${data.filterPiso}` : null,
  ].filter((v): v is string => v !== null);

  return (
    <ModuleSectionCard
      title="Tabla Dinámica · Locales Similares"
      description="Filtro estricto: comparten Tamaño, Tipo y Piso."
    >
      <div className="flex flex-wrap gap-2 px-5 py-3">
        {filterChips.map((chip) => (
          <span
            key={chip}
            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Local</th>
              <th className="px-3 py-2 text-right">Ocupación (m²)</th>
              <th className="px-3 py-2 text-right">Ocupación YTD (m²)</th>
              <th className="px-3 py-2 text-right">Facturación YTD (UF/m²)</th>
              <th className="px-3 py-2 text-right">Ventas YTD (UF/m²)</th>
              <th className="px-3 py-2 text-right">Costo Ocupación YTD (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No hay locales similares para los criterios actuales.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => <Row key={row.unitId} row={row} />)
            )}
            <TotalRow row={data.total} />
          </tbody>
        </table>
      </div>
    </ModuleSectionCard>
  );
}

function Row({ row }: { row: SimilarLocalRow }): JSX.Element {
  return (
    <tr className={cn("hover:bg-slate-50", row.isCurrent && "bg-brand-50/40")}>
      <td className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-slate-700">
        {row.codigo}
        {row.isCurrent ? (
          <span className="ml-2 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">
            Este local
          </span>
        ) : null}
        {row.nombre && row.nombre !== row.codigo ? (
          <span className="ml-2 text-xs text-slate-500">{row.nombre}</span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
        {formatUf(row.ocupacionM2Current, 1)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
        {formatUf(row.ocupacionYtdM2, 1)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
        {formatUfPerM2(row.facturacionYtdUfM2)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
        {formatUfPerM2(row.ventasYtdUfM2)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
        {row.costoOcupacionYtdPct === null ? "N/A" : formatPercent(row.costoOcupacionYtdPct, 2)}
      </td>
    </tr>
  );
}

function TotalRow({ row }: { row: SimilarLocalRow }): JSX.Element {
  return (
    <tr className="border-t-2 border-slate-300 bg-slate-50">
      <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-bold text-slate-800">
        Total
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
        {formatUf(row.ocupacionM2Current, 1)}
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
        {formatUf(row.ocupacionYtdM2, 1)}
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
        {formatUfPerM2(row.facturacionYtdUfM2)}
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
        {formatUfPerM2(row.ventasYtdUfM2)}
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
        {row.costoOcupacionYtdPct === null ? "N/A" : formatPercent(row.costoOcupacionYtdPct, 2)}
      </td>
    </tr>
  );
}
