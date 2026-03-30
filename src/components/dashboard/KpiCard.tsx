import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  subtitleClassName?: string;
  accent?: "green" | "yellow" | "red" | "slate";
  detail?: ReactNode;
  titleAttribute?: string;
};

const accentStyles: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  green: "border-l-4 border-l-emerald-500 bg-white",
  yellow: "border-l-4 border-l-gold-400 bg-white",
  red: "border-l-4 border-l-rose-500 bg-white",
  slate: "border-l-4 border-l-brand-500 bg-white"
};

export function KpiCard({
  title,
  value,
  subtitle,
  subtitleClassName,
  detail,
  titleAttribute,
  accent = "slate"
}: KpiCardProps): JSX.Element {
  return (
    <article
      title={titleAttribute}
      className={cn("rounded-lg border border-slate-200 p-5 shadow-sm", accentStyles[accent])}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      <p className="mt-3 tabular-nums text-3xl font-bold tracking-tight text-brand-700">{value}</p>
      {subtitle ? (
        <p className={cn("mt-1.5 text-xs font-medium text-slate-500", subtitleClassName)}>{subtitle}</p>
      ) : null}
      {detail ? <div className="mt-2">{detail}</div> : null}
    </article>
  );
}
