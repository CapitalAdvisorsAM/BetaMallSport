import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TableDisclosureButtonProps = {
  expanded: boolean;
  label: string;
  onToggle: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function TableDisclosureButton({
  expanded,
  label,
  onToggle,
  loading = false,
  disabled = false,
  className
}: TableDisclosureButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={label}
      aria-expanded={expanded}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1 disabled:opacity-50",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
      )}
    </button>
  );
}
