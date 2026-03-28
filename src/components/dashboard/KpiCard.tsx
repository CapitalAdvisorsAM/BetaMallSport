import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  accent?: "green" | "yellow" | "red" | "slate";
};

const accentStyles: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  green: "border-emerald-200 bg-emerald-50",
  yellow: "border-amber-200 bg-amber-50",
  red: "border-rose-200 bg-rose-50",
  slate: "border-slate-200 bg-white"
};

export function KpiCard({
  title,
  value,
  subtitle,
  accent = "slate"
}: KpiCardProps): JSX.Element {
  return (
    <article className={cn("rounded-xl border p-4 shadow-sm", accentStyles[accent])}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
    </article>
  );
}
