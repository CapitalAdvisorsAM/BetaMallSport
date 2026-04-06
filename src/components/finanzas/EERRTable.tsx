"use client";

import { Fragment } from "react";
import { calculateEbitdaMargin, getEerrValueTone } from "@/lib/finanzas/eerr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { formatUf } from "@/lib/utils";
import type { EerrData } from "@/types/finanzas";

type EERRTableProps = {
  data: EerrData;
  expandedSections: Set<string>;
  onToggleSection: (sectionName: string) => void;
};

const HEAD_CLASS =
  "px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70";

export function EERRTable({ data, expandedSections, onToggleSection }: EERRTableProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="overflow-x-auto">
        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 bg-brand-700 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Cuenta
              </TableHead>
              {data.periodos.map((periodo) => (
                <TableHead key={periodo} className={HEAD_CLASS}>
                  {periodo.slice(0, 7)}
                </TableHead>
              ))}
              <TableHead className={HEAD_CLASS}>Total</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.secciones.map((section) => (
              <Fragment key={section.grupo1}>
                {/* Section header — collapsible */}
                <TableRow
                  className="cursor-pointer bg-slate-50/80 hover:bg-slate-100"
                  onClick={() => onToggleSection(section.grupo1)}
                >
                  <TableCell className="sticky left-0 bg-inherit px-4 py-2.5 font-semibold text-slate-800">
                    <span className="mr-2 text-slate-400">
                      {expandedSections.has(section.grupo1) ? "▼" : "▶"}
                    </span>
                    {section.grupo1}
                  </TableCell>
                  {data.periodos.map((periodo) => (
                    <TableCell
                      key={periodo}
                      className={`px-3 py-2.5 text-right font-semibold ${getEerrValueTone(
                        section.tipo,
                        section.porPeriodo[periodo] ?? 0
                      )}`}
                    >
                      {section.porPeriodo[periodo] !== undefined
                        ? formatUf(section.porPeriodo[periodo])
                        : "—"}
                    </TableCell>
                  ))}
                  <TableCell
                    className={`px-3 py-2.5 text-right font-bold ${getEerrValueTone(
                      section.tipo,
                      section.total
                    )}`}
                  >
                    {formatUf(section.total)}
                  </TableCell>
                </TableRow>

                {/* Detail lines — visible when section is expanded */}
                {expandedSections.has(section.grupo1)
                  ? section.lineas.map((line, index) => (
                      <TableRow
                        key={`${section.grupo1}-${line.grupo3}`}
                        className={index % 2 === 0 ? "bg-white hover:bg-brand-50" : "bg-slate-50/60 hover:bg-brand-50"}
                      >
                        <TableCell className="sticky left-0 bg-inherit py-2 pl-10 pr-4 text-slate-600">
                          {line.grupo3}
                        </TableCell>
                        {data.periodos.map((periodo) => (
                          <TableCell
                            key={periodo}
                            className={`px-3 py-2 text-right ${getEerrValueTone(
                              line.tipo,
                              line.porPeriodo[periodo] ?? 0
                            )}`}
                          >
                            {line.porPeriodo[periodo] !== undefined
                              ? formatUf(line.porPeriodo[periodo])
                              : "—"}
                          </TableCell>
                        ))}
                        <TableCell
                          className={`px-3 py-2 text-right font-medium ${getEerrValueTone(
                            line.tipo,
                            line.total
                          )}`}
                        >
                          {formatUf(line.total)}
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </Fragment>
            ))}

            {/* EBITDA summary row */}
            <TableRow className="border-t-2 border-slate-300 bg-brand-700/5 hover:bg-brand-700/5">
              <TableCell className="sticky left-0 bg-inherit px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-800">
                EBITDA
              </TableCell>
              {data.periodos.map((periodo) => {
                const value = data.ebitda.porPeriodo[periodo] ?? 0;
                return (
                  <TableCell
                    key={periodo}
                    className={`px-3 py-3 text-right text-sm font-bold ${
                      value >= 0 ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {formatUf(value)}
                  </TableCell>
                );
              })}
              <TableCell
                className={`px-3 py-3 text-right text-sm font-bold ${
                  data.ebitda.total >= 0 ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {formatUf(data.ebitda.total)}
              </TableCell>
            </TableRow>

            {/* EBITDA margin row — only shown when there are income sections */}
            {data.secciones.some((section) => section.tipo === "ingreso") ? (
              <TableRow className="bg-brand-700/5 hover:bg-brand-700/5">
                <TableCell className="sticky left-0 bg-inherit px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mg EBITDA (%)
                </TableCell>
                {data.periodos.map((periodo) => {
                  const ingresos = data.secciones
                    .filter((section) => section.tipo === "ingreso")
                    .reduce((acc, section) => acc + (section.porPeriodo[periodo] ?? 0), 0);
                  const margin = calculateEbitdaMargin(
                    ingresos,
                    data.ebitda.porPeriodo[periodo] ?? 0
                  );

                  return (
                    <TableCell
                      key={periodo}
                      className={`px-3 py-2 text-right text-xs font-semibold ${
                        margin !== null && margin >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {margin !== null ? `${formatUf(margin, 1)}%` : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                  —
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
