import { cn } from "@/lib/utils";
import { getValueTone, getVarianceTone, TONE_BG_CLASS, type FlowKind, type Tone } from "@/lib/finance/value-tone";

type DeltaPillProps = {
  value: number | null | undefined;
  kind?: FlowKind;
  mode?: "value" | "variance";
  suffix?: string;
  decimals?: number;
  size?: "sm" | "md";
  showArrow?: boolean;
  className?: string;
};

const DASH = "\u2014";

function formatNumber(n: number, decimals: number): string {
  return n.toLocaleString("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function DeltaPill({
  value,
  kind = "ingreso",
  mode = "variance",
  suffix = "%",
  decimals = 1,
  size = "sm",
  showArrow = true,
  className,
}: DeltaPillProps): JSX.Element {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 num",
          size === "sm" ? "text-[11px]" : "text-xs",
          "bg-surface-100 text-slate-400",
          className
        )}
      >
        {DASH}
      </span>
    );
  }

  const tone: Tone = mode === "variance" ? getVarianceTone(kind, value) : getValueTone(kind, value);
  const arrow = value > 0 ? "\u25B2" : value < 0 ? "\u25BC" : "\u2022";
  const sign = value > 0 ? "+" : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 num font-medium",
        size === "sm" ? "text-[11px]" : "text-xs",
        TONE_BG_CLASS[tone],
        className
      )}
    >
      {showArrow ? <span aria-hidden className="text-[9px] leading-none">{arrow}</span> : null}
      <span>
        {sign}
        {formatNumber(value, decimals)}
        {suffix}
      </span>
    </span>
  );
}

export default DeltaPill;
