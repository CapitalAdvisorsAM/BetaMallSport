import { cn } from "@/lib/utils";
import {
  diffPct,
  formatPanelDelta,
  formatPanelValue,
  formatPanelYoy,
  realVsPptoSemaphore,
  yoySemaphore
} from "@/lib/real/panel-cdg-format";
import { StatChip } from "@/components/ui/StatChip";
import type { Tone } from "@/lib/real/value-tone";
import type { PanelCdgCell, PanelCdgKpi, PanelCdgUnit } from "@/types/panel-cdg";

type PanelCdgProps = {
  kpis: PanelCdgKpi[];
  reportDate: string | null;
  className?: string;
};

const TOTAL_COLS = 1 + 7 + 7;

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
                colSpan={7}
                className="border-b border-r border-surface-200 px-3 py-2 text-center overline text-slate-500"
              >
                Mes
              </th>
              <th
                colSpan={7}
                className="border-b border-surface-200 px-3 py-2 text-center overline text-slate-500"
              >
                YTD
              </th>
            </tr>
            <tr className="text-right">
              {[0, 1].map((i) => (
                <ColumnSubHeader key={i} borderRight={i === 0} />
              ))}
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
                <td colSpan={TOTAL_COLS} className="px-3 py-6 text-center text-sm text-slate-500">
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

function ColumnSubHeader({ borderRight }: { borderRight: boolean }): JSX.Element {
  const cell = "border-b border-surface-200 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400";
  const right = borderRight ? "border-r" : "";
  return (
    <>
      <th className={cell}>2026R</th>
      <th className={cell}>2026P</th>
      <th className={cell}>2025R</th>
      <th className={cell}>Δ Ppto</th>
      <th className={cell}>Δ Ppto %</th>
      <th className={cell}>Δ YoY</th>
      <th className={cn(cell, right)}>Δ YoY %</th>
    </>
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
          <td colSpan={TOTAL_COLS} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
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
      <PeriodCells cell={kpi.mes} unit={kpi.unit} borderRight />
      <PeriodCells cell={kpi.ytd} unit={kpi.unit} />
    </tr>
  );
}

type PeriodCellsProps = {
  cell: PanelCdgCell;
  unit: PanelCdgUnit;
  borderRight?: boolean;
};

function PeriodCells({ cell, unit, borderRight = false }: PeriodCellsProps): JSX.Element {
  const realTone = semaphoreToTone(realVsPptoSemaphore(cell.real, cell.ppto));
  const realText =
    realTone === "positive"
      ? "text-positive-700"
      : realTone === "negative"
        ? "text-negative-700"
        : "text-slate-800";

  const deltaPpto = cell.real !== null && cell.ppto !== null ? cell.real - cell.ppto : null;
  const deltaPptoPct = diffPct(cell.real, cell.ppto);
  const deltaYoy = cell.real !== null && cell.prior !== null ? cell.real - cell.prior : null;
  const yoyTone = semaphoreToTone(yoySemaphore(cell.yoy));

  return (
    <>
      <td className={cn("px-2 py-2 text-right num font-semibold", realText)}>
        {formatPanelValue(cell.real, unit)}
      </td>
      <td className="px-2 py-2 text-right num text-slate-500">
        {formatPanelValue(cell.ppto, unit)}
      </td>
      <td className="px-2 py-2 text-right num text-slate-500">
        {formatPanelValue(cell.prior, unit)}
      </td>
      <td className="px-2 py-2 text-right num text-slate-700">
        {formatPanelDelta(deltaPpto, unit)}
      </td>
      <td className="px-2 py-2 text-right num">
        <StatChip tone={semaphoreToTone(realVsPptoSemaphore(cell.real, cell.ppto))} size="sm">
          {formatPanelYoy(deltaPptoPct)}
        </StatChip>
      </td>
      <td className="px-2 py-2 text-right num text-slate-700">
        {formatPanelDelta(deltaYoy, unit)}
      </td>
      <td className={cn("px-2 py-2 text-right num", borderRight && "border-r border-surface-200")}>
        <StatChip tone={yoyTone} size="sm">
          {formatPanelYoy(cell.yoy)}
        </StatChip>
      </td>
    </>
  );
}

export default PanelCdg;
