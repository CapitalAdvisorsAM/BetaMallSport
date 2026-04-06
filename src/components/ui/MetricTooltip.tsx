import { getMetricFormula, type MetricFormulaId } from "@/lib/metric-formulas";

type MetricTooltipProps = {
  metricId: MetricFormulaId;
};

export function MetricTooltip({ metricId }: MetricTooltipProps): JSX.Element {
  const metric = getMetricFormula(metricId);
  const ariaLabel = `Como se calcula. Formula: ${metric.formula}. ${metric.detail}`;

  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        title={metric.formula}
        aria-label={ariaLabel}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-semibold leading-none text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-md bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-200">
          Como se calcula
        </span>
        <span className="mt-1 block font-mono text-[11px] text-slate-100">{metric.formula}</span>
        <span className="mt-1 block text-[11px] text-slate-200">{metric.detail}</span>
      </span>
    </span>
  );
}
