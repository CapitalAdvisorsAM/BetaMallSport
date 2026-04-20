import { cn } from "@/lib/utils";
import {
  formatPanelValue,
  formatPanelYoy,
  realVsPptoSemaphore,
  yoySemaphore
} from "@/lib/finance/panel-cdg-format";
import { StatChip } from "@/components/ui/StatChip";
import type { Tone } from "@/lib/finance/value-tone";
import type { PanelCdgCell, PanelCdgKpi, PanelCdgUnit } from "@/types/panel-cdg";

type PanelCdgProps = {
  kpis: PanelCdgKpi[];
  reportDate: string | null;
  className?: string;
};

function semaphoreToTone(sem: "green" | "amber" | "red" | "neutral"): Tone {
  if (sem === "green") return "positive";
  if (sem === "red") return "negative";
  if (sem === "amber") return "negative";
  return "neutral";
}

export function PanelCdg({ kpis, reportDate, className }: PanelCdgProps): JSX.Element {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-surface-200 bg-white shadow-card",
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-surface-200 bg-surface-50/60 px-5 py-3">
        <div>
          <h2 className="overline text-brand-700">Panel CDG</h2>
          <p className="mt-0.5 text-caption text-slate-500">Indicadores clave — mes y acumulado.</p>
        </div>
        <span className="text-xs text-slate-500 num">
          {reportDate ? `Reporte ${reportDate}` : "Sin fecha de reporte"}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-10 border-b border-surface-200 bg-white px-4 py-2.5 text-left overline text-slate-500"
                style={{ boxShadow: "2px 0 0 0 rgb(226 232 240)" }}
              >
                KPI
              </th>
              <th
                colSpan={3}
                className="border-b border-r border-surface-200 px-3 py-2 text-center overline text-slate-500"
              >
                Mes
              </th>
              <th
                colSpan={3}
                className="border-b border-surface-200 px-3 py-2 text-center overline text-slate-500"
              >
                YTD
              </th>
            </tr>
            <tr className="text-right">
              <th className="border-b border-surface-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Real</th>
              <th className="border-b border-surface-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Ppto</th>
              <th className="border-b border-r border-surface-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">YoY</th>
              <th className="border-b border-surface-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Real</th>
              <th className="border-b border-surface-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Ppto</th>
              <th className="border-b border-surface-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">YoY</th>
            </tr>
          </thead>
          <tbody>
            {kpis.map((kpi, index) => {
              const previous = index > 0 ? kpis[index - 1] : null;
              const showSection = Boolean(kpi.section && kpi.section !== previous?.section);
              return (
                <SectionedPanelRow
                  key={kpi.key}
                  kpi={kpi}
                  zebra={index % 2 === 1}
                  showSection={showSection}
                />
              );
            })}
            {kpis.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                  Sin datos disponibles para la fecha de reporte seleccionada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SectionedPanelRow({
  kpi,
  zebra,
  showSection
}: {
  kpi: PanelCdgKpi;
  zebra: boolean;
  showSection: boolean;
}): JSX.Element {
  return (
    <>
      {showSection ? (
        <tr className="border-t border-surface-200 bg-surface-50/70">
          <td colSpan={7} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {kpi.section}
          </td>
        </tr>
      ) : null}
      <PanelRow kpi={kpi} zebra={zebra} />
    </>
  );
}

type PanelRowProps = { kpi: PanelCdgKpi; zebra: boolean };

function PanelRow({ kpi, zebra }: PanelRowProps): JSX.Element {
  return (
    <tr className={cn("border-t border-surface-200/70 transition-colors hover:bg-brand-50/50", zebra && "bg-surface-50/40")}>
      <td
        className={cn(
          "sticky left-0 z-10 px-4 py-2 font-medium text-slate-800",
          zebra ? "bg-surface-50/70" : "bg-white"
        )}
        style={{ boxShadow: "2px 0 0 0 rgb(226 232 240 / 0.6)" }}
      >
        {kpi.label}
      </td>
      <PanelCell cell={kpi.mes} unit={kpi.unit} kind="real" />
      <PanelCell cell={kpi.mes} unit={kpi.unit} kind="ppto" />
      <PanelCell cell={kpi.mes} unit={kpi.unit} kind="yoy" borderRight />
      <PanelCell cell={kpi.ytd} unit={kpi.unit} kind="real" />
      <PanelCell cell={kpi.ytd} unit={kpi.unit} kind="ppto" />
      <PanelCell cell={kpi.ytd} unit={kpi.unit} kind="yoy" />
    </tr>
  );
}

type PanelCellProps = {
  cell: PanelCdgCell;
  unit: PanelCdgUnit;
  kind: "real" | "ppto" | "yoy";
  borderRight?: boolean;
};

function PanelCell({ cell, unit, kind, borderRight = false }: PanelCellProps): JSX.Element {
  const borderCls = borderRight ? "border-r border-surface-200" : "";

  if (kind === "yoy") {
    const tone = semaphoreToTone(yoySemaphore(cell.yoy));
    return (
      <td className={cn("px-3 py-2 text-right num", borderCls)}>
        <StatChip tone={tone} size="sm">
          {formatPanelYoy(cell.yoy)}
        </StatChip>
      </td>
    );
  }

  const value = kind === "real" ? cell.real : cell.ppto;

  if (kind === "real") {
    const tone = semaphoreToTone(realVsPptoSemaphore(cell.real, cell.ppto));
    const text =
      tone === "positive"
        ? "text-positive-700"
        : tone === "negative"
          ? "text-negative-700"
          : "text-slate-800";
    return (
      <td className={cn("px-3 py-2 text-right num font-semibold", text, borderCls)}>
        {formatPanelValue(value, unit)}
      </td>
    );
  }

  return (
    <td className={cn("px-3 py-2 text-right num text-slate-500", borderCls)}>
      {formatPanelValue(value, unit)}
    </td>
  );
}

export default PanelCdg;
