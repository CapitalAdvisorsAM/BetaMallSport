"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TableDisclosureButton } from "@/components/ui/TableDisclosureButton";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import { formatClp, formatDateString, formatUf } from "@/lib/utils";
import type { TenantHistoryEntry, TenantHistoryRate, TenantHistoryDiscount } from "@/types/local-360";

type TenantHistoryTableProps = {
  history: TenantHistoryEntry[];
  selectedProjectId: string;
};

export function TenantHistoryTable({
  history,
  selectedProjectId,
}: TenantHistoryTableProps): JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <ModuleSectionCard title="Detalle por contrato">
        <p className="px-4 py-6 text-center text-sm text-slate-400">Sin contratos.</p>
      </ModuleSectionCard>
    );
  }

  return (
    <ModuleSectionCard
      title="Detalle por contrato"
      description="Métricas dentro del rango seleccionado. Expande una fila para ver escaladores y descuentos."
    >
      <div className="overflow-x-auto">
        <table className={tableTheme.table}>
          <thead className={tableTheme.head}>
            <tr>
              <th className={tableTheme.compactHeadCell}>Arrendatario</th>
              <th className={tableTheme.compactHeadCell}>RUT</th>
              <th className={tableTheme.compactHeadCell}>Inicio</th>
              <th className={tableTheme.compactHeadCell}>Término</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>Días en rango</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>Renta UF/mes</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>Facturación UF</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>Ventas CLP</th>
              <th className={tableTheme.compactHeadCell}>Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((entry, index) => {
              const isExpanded = expandedId === entry.contractId;
              return (
                <Fragment key={entry.contractId}>
                  <tr className={`${getStripedRowClass(index)} ${tableTheme.rowHover}`}>
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <TableDisclosureButton
                          expanded={isExpanded}
                          label={`${isExpanded ? "Contraer" : "Expandir"} ${entry.tenantName}`}
                          onToggle={() => setExpandedId(isExpanded ? null : entry.contractId)}
                        />
                        <Link
                          href={`/tenants/${entry.tenantId}?proyecto=${selectedProjectId}`}
                          className="text-brand-700 underline-offset-2 hover:underline"
                        >
                          {entry.tenantName}
                          {entry.isCurrent ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Actual</span> : null}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{entry.tenantRut}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{formatDateString(entry.fechaInicio)}</td>
                    <td className="px-3 py-2.5 text-sm text-slate-600">{formatDateString(entry.fechaTermino)}</td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">{entry.daysInRange.toLocaleString("es-CL")}</td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                      {entry.monthlyRentUf !== null ? formatUf(entry.monthlyRentUf) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                      {entry.totalBillingUf > 0 ? formatUf(entry.totalBillingUf) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                      {entry.totalSalesPesos > 0 ? formatClp(entry.totalSalesPesos) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <StatusBadge status={entry.estado} />
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className={getStripedRowClass(index)}>
                      <td colSpan={9} className="px-5 py-4">
                        <ExpandedDetail rates={entry.rateEvolution} discounts={entry.discounts} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </ModuleSectionCard>
  );
}

function ExpandedDetail({
  rates,
  discounts,
}: {
  rates: TenantHistoryRate[];
  discounts: TenantHistoryDiscount[];
}): JSX.Element {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Evolución de tarifas ({rates.length})
        </p>
        {rates.length === 0 ? (
          <p className="text-sm text-slate-400">Sin tarifas registradas.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left">Desde</th>
                <th className="text-left">Hasta</th>
                <th className="text-left">Tipo</th>
                <th className="text-right">Valor</th>
                <th className="text-center">Dic.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rates.map((r, i) => (
                <tr key={`${r.vigenciaDesde}-${i}`}>
                  <td className="py-1.5 tabular-nums text-slate-600">{formatDateString(r.vigenciaDesde)}</td>
                  <td className="py-1.5 tabular-nums text-slate-600">{formatDateString(r.vigenciaHasta)}</td>
                  <td className="py-1.5 text-slate-700">{r.tipo}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-800">{formatUf(r.valor, 4)}</td>
                  <td className="py-1.5 text-center text-slate-500">{r.esDiciembre ? "✓" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Descuentos ({discounts.length})
        </p>
        {discounts.length === 0 ? (
          <p className="text-sm text-slate-400">Sin descuentos aplicados.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left">Desde</th>
                <th className="text-left">Hasta</th>
                <th className="text-left">Tipo</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discounts.map((d, i) => (
                <tr key={`${d.vigenciaDesde}-${i}`}>
                  <td className="py-1.5 tabular-nums text-slate-600">{formatDateString(d.vigenciaDesde)}</td>
                  <td className="py-1.5 tabular-nums text-slate-600">{formatDateString(d.vigenciaHasta)}</td>
                  <td className="py-1.5 text-slate-700">{d.tipo}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-800">{formatUf(d.valor, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
