"use client";

import { Fragment, useState } from "react";
import { ModuleSectionCard } from "@/components/dashboard/ModuleSectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TableDisclosureButton } from "@/components/ui/TableDisclosureButton";
import { getStripedRowClass, tableTheme } from "@/components/ui/table-theme";
import { cn, formatSquareMeters, formatUf } from "@/lib/utils";
import type { Tenant360Contract } from "@/types/tenant-360";

type ContractDetailsSectionProps = {
  contracts: Tenant360Contract[];
};

function rateLabel(tipo: string): string {
  switch (tipo) {
    case "FIJO_UF_M2": return "UF/m\u00b2";
    case "FIJO_UF": return "UF fija";
    case "PORCENTAJE": return "% Variable";
    default: return tipo;
  }
}

export function ContractDetailsSection({ contracts }: ContractDetailsSectionProps): JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (contracts.length === 0) {
    return (
      <ModuleSectionCard title="Contratos">
        <p className="px-4 py-6 text-center text-sm text-slate-400">Sin contratos registrados.</p>
      </ModuleSectionCard>
    );
  }

  return (
    <ModuleSectionCard title="Contratos" description={`${contracts.length} contrato(s)`}>
      <div className="overflow-x-auto">
        <table className={tableTheme.table}>
          <thead className={tableTheme.head}>
            <tr>
              <th className={tableTheme.compactHeadCell}>Local</th>
              <th className={tableTheme.compactHeadCell}>N° Contrato</th>
              <th className={tableTheme.compactHeadCell}>Estado</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>Tarifa</th>
              <th className={tableTheme.compactHeadCell}>Inicio</th>
              <th className={tableTheme.compactHeadCell}>Termino</th>
              <th className={`${tableTheme.compactHeadCell} text-right`}>Dias Rest.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contracts.map((c, index) => {
              const isExpanded = expandedId === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className={`${getStripedRowClass(index)} ${tableTheme.rowHover}`}>
                    <td className="px-3 py-2.5 text-sm font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <TableDisclosureButton
                          expanded={isExpanded}
                          label={`${isExpanded ? "Contraer" : "Expandir"} ${c.localCodigo}`}
                          onToggle={() => setExpandedId(isExpanded ? null : c.id)}
                          className="h-5 w-5"
                        />
                        <span>{c.localCodigo}</span>
                      </div>
                      <p className="ml-6 text-xs text-slate-400">{c.localNombre} &middot; {formatSquareMeters(c.localGlam2)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-sm tabular-nums text-slate-600">{c.numeroContrato}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={c.estado} /></td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                      {c.tarifaActual ? (
                        <span>{formatUf(c.tarifaActual.valor)} <span className="text-xs text-slate-400">{rateLabel(c.tarifaActual.tipo)}</span></span>
                      ) : "\u2014"}
                    </td>
                    <td className="px-3 py-2.5 text-sm tabular-nums text-slate-600">{c.fechaInicio}</td>
                    <td className="px-3 py-2.5 text-sm tabular-nums text-slate-600">{c.fechaTermino}</td>
                    <td className={cn(
                      "px-3 py-2.5 text-right text-sm font-semibold tabular-nums",
                      c.diasRestantes <= 30 ? "text-rose-600" : c.diasRestantes <= 90 ? "text-amber-600" : "text-slate-700"
                    )}>
                      {c.diasRestantes}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {isExpanded ? (
                    <tr className="bg-slate-50/50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-4">
                          {/* Rate History */}
                          {c.historialTarifas.length > 0 ? (
                            <div>
                              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">Historial de Tarifas</h4>
                              <table className={`${tableTheme.table} text-xs`}>
                                <thead className={tableTheme.head}>
                                  <tr>
                                    <th className={tableTheme.compactHeadCell}>Tipo</th>
                                    <th className={`${tableTheme.compactHeadCell} text-right`}>Valor</th>
                                    <th className={`${tableTheme.compactHeadCell} text-right`}>Umbral UF</th>
                                    <th className={tableTheme.compactHeadCell}>Desde</th>
                                    <th className={tableTheme.compactHeadCell}>Hasta</th>
                                    <th className={tableTheme.compactHeadCell}>Dic.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {c.historialTarifas.map((t, i) => (
                                    <tr key={i}>
                                      <td className="px-3 py-1 text-slate-600">{rateLabel(t.tipo)}</td>
                                      <td className="px-3 py-1 text-right tabular-nums text-slate-700">{formatUf(t.valor)}</td>
                                      <td className="px-3 py-1 text-right tabular-nums text-slate-500">{t.umbralVentasUf !== null && t.umbralVentasUf !== 0 ? formatUf(t.umbralVentasUf) : "\u2014"}</td>
                                      <td className="px-3 py-1 tabular-nums text-slate-500">{t.vigenciaDesde}</td>
                                      <td className="px-3 py-1 tabular-nums text-slate-500">{t.vigenciaHasta ?? "\u2014"}</td>
                                      <td className="px-3 py-1 text-slate-500">{t.esDiciembre ? "Si" : ""}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}

                          {/* GGCC */}
                          {c.ggccActual ? (
                            <div>
                              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">Gastos Comunes</h4>
                              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                                <div>
                                  <p className="text-slate-400">Base UF/m²</p>
                                  <p className="font-medium tabular-nums text-slate-700">{formatUf(c.ggccActual.tarifaBaseUfM2)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400">% Administracion</p>
                                  <p className="font-medium tabular-nums text-slate-700">{c.ggccActual.pctAdministracion}%</p>
                                </div>
                                {c.ggccActual.pctReajuste !== null ? (
                                  <div>
                                    <p className="text-slate-400">% Reajuste</p>
                                    <p className="font-medium tabular-nums text-slate-700">{c.ggccActual.pctReajuste}%</p>
                                  </div>
                                ) : null}
                                {c.ggccActual.proximoReajuste ? (
                                  <div>
                                    <p className="text-slate-400">Proximo reajuste</p>
                                    <p className="font-medium tabular-nums text-slate-700">{c.ggccActual.proximoReajuste}</p>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}

                          {/* Amendments */}
                          {c.anexos.length > 0 ? (
                            <div>
                              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">Anexos</h4>
                              <div className="space-y-1.5">
                                {c.anexos.map((a) => (
                                  <div key={a.id} className="flex items-start gap-3 text-xs">
                                    <span className="shrink-0 tabular-nums text-slate-400">{a.fecha}</span>
                                    <span className="text-slate-600">{a.descripcion}</span>
                                    {a.camposModificados.length > 0 ? (
                                      <span className="text-slate-400">({a.camposModificados.join(", ")})</span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Contract meta */}
                          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                            {c.codigoCC ? <span>CC: {c.codigoCC}</span> : null}
                            {c.diasGracia > 0 ? <span>Gracia: {c.diasGracia}d</span> : null}
                            {c.multiplicadorDiciembre !== null ? <span>Mult. dic: {c.multiplicadorDiciembre}x</span> : null}
                            {c.multiplicadorJunio !== null ? <span>Mult. jun: {c.multiplicadorJunio}x</span> : null}
                            {c.multiplicadorJulio !== null ? <span>Mult. jul: {c.multiplicadorJulio}x</span> : null}
                            {c.multiplicadorAgosto !== null ? <span>Mult. ago: {c.multiplicadorAgosto}x</span> : null}
                            {c.pctFondoPromocion !== null ? <span>Fondo prom: {c.pctFondoPromocion}%</span> : null}
                            {c.pdfUrl ? (
                              <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 underline underline-offset-2 hover:text-brand-700">
                                Ver PDF
                              </a>
                            ) : null}
                          </div>
                        </div>
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
