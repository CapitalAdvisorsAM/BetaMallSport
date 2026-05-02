"use client";

import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import {
  formatClp,
  formatPeriodoCorto,
  formatPercent,
  formatUf,
  formatUfPerM2,
} from "@/lib/utils";
import type { CategoryAnalysis, LocalCommercialAnalysisRow } from "@/types/local-360";

type Props = {
  data: CategoryAnalysis;
  periods: string[];
};

type FormatKind = "m2" | "ufm2" | "clp" | "uf" | "pct";

function detectFormat(metric: string): FormatKind {
  if (metric.includes("(M2)")) return "m2";
  if (metric.includes("UF/M2")) return "ufm2";
  if (metric.includes("(CLP)")) return "clp";
  if (metric.includes("(UF)")) return "uf";
  if (metric.includes("(%)")) return "pct";
  return "uf";
}

function formatValue(value: number | null, kind: FormatKind): string {
  if (value === null) return "N/A";
  switch (kind) {
    case "m2":
      return formatUf(value, 1);
    case "ufm2":
      return formatUfPerM2(value);
    case "clp":
      return formatClp(value);
    case "uf":
      return formatUf(value, 2);
    case "pct":
      return formatPercent(value, 2);
  }
}

export function CategoryAnalysisSection({ data, periods }: Props): JSX.Element {
  return (
    <ModuleSectionCard
      title="Análisis por Categoría (Tipo)"
      description={`Tipo: ${data.categoria} · agregado de todos los locales activos del mismo tipo.`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Métrica</th>
              {periods.map((p) => (
                <th key={p} className="px-3 py-2 text-right">
                  {formatPeriodoCorto(p)}
                </th>
              ))}
              <th className="bg-brand-50 px-3 py-2 text-right text-brand-700">YTD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((row) => (
              <Row key={row.metric} row={row} periods={periods} />
            ))}
          </tbody>
        </table>
      </div>
    </ModuleSectionCard>
  );
}

function Row({
  row,
  periods,
}: {
  row: LocalCommercialAnalysisRow;
  periods: string[];
}): JSX.Element {
  const kind = detectFormat(row.metric);
  return (
    <tr className="hover:bg-slate-50">
      <td className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-slate-700">
        {row.metric}
      </td>
      {periods.map((p) => (
        <td key={p} className="px-3 py-2 text-right tabular-nums text-slate-700">
          {formatValue(row.byPeriod[p] ?? null, kind)}
        </td>
      ))}
      <td className="bg-brand-50 px-3 py-2 text-right font-semibold tabular-nums text-brand-700">
        {formatValue(row.ytd, kind)}
      </td>
    </tr>
  );
}
