"use client";

import { useState } from "react";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import {
  cn,
  formatClp,
  formatPeriodoCorto,
  formatPercent,
  formatUf,
  formatUfPerM2,
} from "@/lib/utils";
import type {
  LocalCommercialAnalysisRow,
  LocalCommercialBreakdownRow,
  TenantOnLocalAnalysis,
} from "@/types/local-360";

type Props = {
  data: TenantOnLocalAnalysis;
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

export function TenantOnLocalAnalysisSection({ data, periods }: Props): JSX.Element {
  const [breakdownView, setBreakdownView] = useState<"ufm2" | "uf">("ufm2");
  const breakdownRows = breakdownView === "ufm2" ? data.breakdownUfM2 : data.breakdownUf;
  const breakdownKind: FormatKind = breakdownView === "ufm2" ? "ufm2" : "uf";

  return (
    <ModuleSectionCard
      title={`Análisis del Cliente · ${data.tenantName}`}
      description={data.isCurrent ? "Arrendatario vigente" : "Histórico"}
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
              <MetricRow key={row.metric} row={row} periods={periods} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Breakdown Facturación</h4>
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
            {(["ufm2", "uf"] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => setBreakdownView(kind)}
                className={cn(
                  "rounded px-3 py-1 font-medium",
                  breakdownView === kind ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {kind === "ufm2" ? "UF/m²" : "UF"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Concepto</th>
              {periods.map((p) => (
                <th key={p} className="px-3 py-2 text-right">
                  {formatPeriodoCorto(p)}
                </th>
              ))}
              <th className="bg-brand-50 px-3 py-2 text-right text-brand-700">YTD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {breakdownRows.map((row) => (
              <BreakdownRow key={row.group3} row={row} periods={periods} kind={breakdownKind} />
            ))}
            <TotalRow row={data.totalFacturacionUfM2} periods={periods} kind={breakdownKind} />
          </tbody>
        </table>
      </div>
    </ModuleSectionCard>
  );
}

function MetricRow({
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

function BreakdownRow({
  row,
  periods,
  kind,
}: {
  row: LocalCommercialBreakdownRow;
  periods: string[];
  kind: FormatKind;
}): JSX.Element {
  return (
    <tr className="hover:bg-slate-50">
      <td className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-slate-600">{row.group3}</td>
      {periods.map((p) => (
        <td key={p} className="px-3 py-2 text-right tabular-nums text-slate-700">
          {formatValue(row.byPeriod[p] ?? 0, kind)}
        </td>
      ))}
      <td className="bg-brand-50 px-3 py-2 text-right font-semibold tabular-nums text-brand-700">
        {formatValue(row.ytd, kind)}
      </td>
    </tr>
  );
}

function TotalRow({
  row,
  periods,
  kind,
}: {
  row: LocalCommercialAnalysisRow;
  periods: string[];
  kind: FormatKind;
}): JSX.Element {
  return (
    <tr className="border-t-2 border-slate-300 bg-slate-50">
      <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-bold text-slate-800">
        Total Facturación Cliente
      </td>
      {periods.map((p) => (
        <td key={p} className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
          {formatValue(row.byPeriod[p] ?? 0, kind)}
        </td>
      ))}
      <td className="bg-brand-100 px-3 py-2 text-right font-bold tabular-nums text-brand-700">
        {formatValue(row.ytd, kind)}
      </td>
    </tr>
  );
}
