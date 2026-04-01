"use client";

import { cn, formatDecimal } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

export type RentRollDashboardTableRow = {
  id: string;
  local: string;
  arrendatario: string;
  glam2: number;
  tarifaUfM2: number;
  rentaFijaUf: number;
  ggccUf: number;
  ventasUf: number | null;
};

type RentRollDashboardTableProps = {
  rows: RentRollDashboardTableRow[];
  totals: {
    glam2: number;
    rentaFijaUf: number;
    ggccUf: number;
    ventasUf: number;
  };
};

export function RentRollDashboardTable({
  rows,
  totals
}: RentRollDashboardTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No hay contratos ocupados o en gracia para el periodo seleccionado.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <Table className="min-w-full divide-y divide-slate-200 text-sm">
        <TableHeader className="bg-brand-700">
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Local
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                Arrendatario
            </TableHead>
            <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                GLA m2
            </TableHead>
            <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                Tarifa UF/m2/mes
            </TableHead>
            <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                Renta Fija (UF)
            </TableHead>
            <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                GGCC (UF)
            </TableHead>
            <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                Ventas (UF)
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                className={cn(
                  "transition-colors hover:bg-brand-50",
                  index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                )}
              >
                <TableCell className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{row.local}</TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-slate-700">{row.arrendatario}</TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatDecimal(row.glam2)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatDecimal(row.tarifaUfM2)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatDecimal(row.rentaFijaUf)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatDecimal(row.ggccUf)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {row.ventasUf == null ? "–" : formatDecimal(row.ventasUf)}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
        <TableFooter className="bg-brand-50 font-semibold text-slate-900">
          <TableRow className="bg-brand-50 font-semibold text-slate-900 hover:bg-brand-50">
            <TableCell className="px-4 py-3" colSpan={2}>
                Totales
            </TableCell>
            <TableCell className="whitespace-nowrap px-4 py-3 text-right">{formatDecimal(totals.glam2)}</TableCell>
            <TableCell className="px-4 py-3" />
            <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                {formatDecimal(totals.rentaFijaUf)}
            </TableCell>
            <TableCell className="whitespace-nowrap px-4 py-3 text-right">{formatDecimal(totals.ggccUf)}</TableCell>
            <TableCell className="whitespace-nowrap px-4 py-3 text-right">{formatDecimal(totals.ventasUf)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

