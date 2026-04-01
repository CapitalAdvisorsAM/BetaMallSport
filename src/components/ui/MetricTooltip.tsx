type MetricTooltipProps = {
  explanation: string;
};

export function MetricTooltip({ explanation }: MetricTooltipProps): JSX.Element {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        title={explanation}
        aria-label={explanation}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-semibold leading-none text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-md bg-slate-900 px-3 py-2 text-left text-xs font-medium leading-relaxed text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {explanation}
      </span>
    </span>
  );
}
