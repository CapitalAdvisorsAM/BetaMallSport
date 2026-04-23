import { formatUf } from "@/lib/utils";

type OccupancyBadgeProps = {
  pct: number | null;
};

export function OccupancyBadge({ pct }: OccupancyBadgeProps): JSX.Element {
  if (pct === null) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">Sin ventas</span>
    );
  }

  const colorClass =
    pct < 10
      ? "bg-emerald-100 text-emerald-700"
      : pct < 15
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
      {formatUf(pct, 1)}%
    </span>
  );
}
