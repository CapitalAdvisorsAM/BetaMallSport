import { cn } from "@/lib/utils";
import { TONE_BG_CLASS, type Tone } from "@/lib/finance/value-tone";

type StatChipProps = {
  children: React.ReactNode;
  tone?: Tone;
  variant?: "soft" | "outline";
  size?: "sm" | "md";
  className?: string;
};

const OUTLINE_CLASS: Record<Tone, string> = {
  positive: "border-positive-100 text-positive-700",
  negative: "border-negative-100 text-negative-700",
  neutral: "border-surface-200 text-slate-600",
};

export function StatChip({
  children,
  tone = "neutral",
  variant = "soft",
  size = "sm",
  className,
}: StatChipProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 num font-medium",
        size === "sm" ? "text-[11px]" : "text-xs",
        variant === "soft"
          ? TONE_BG_CLASS[tone]
          : cn("border bg-white", OUTLINE_CLASS[tone]),
        className
      )}
    >
      {children}
    </span>
  );
}

export default StatChip;
