import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ValueBadge = "teorico" | "efectivo";

const VALUE_BADGE_CONFIG: Record<ValueBadge, { label: string; className: string }> = {
  teorico: { label: "Teórico", className: "bg-warning-100 text-warning-700" },
  efectivo: { label: "Efectivo", className: "bg-positive-100 text-positive-700" },
};

type ModuleHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  valueBadges?: ValueBadge[];
  asOf?: string | null;
  overline?: string;
  className?: string;
};

function formatAsOf(iso: string): { month: string; day: string; year: string } | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(iso);
  if (!match) return null;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = match[3] ?? "01";
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  if (monthIdx < 0 || monthIdx > 11) return null;
  return { month: monthNames[monthIdx], day, year };
}

export function ModuleHeader({
  title,
  description,
  actions,
  valueBadges,
  asOf,
  overline,
  className,
}: ModuleHeaderProps): JSX.Element {
  const asOfParts = asOf ? formatAsOf(asOf) : null;

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-md border border-surface-200 bg-white p-5 shadow-card",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-gold-400",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {overline ? (
            <p className="overline text-slate-400">{overline}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-headline font-medium text-brand-700" style={{ fontVariationSettings: '"opsz" 64, "wght" 500' }}>
              {title}
            </h2>
            {valueBadges?.map((badge) => {
              const cfg = VALUE_BADGE_CONFIG[badge];
              return (
                <span
                  key={badge}
                  className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-wide", cfg.className)}
                >
                  {cfg.label}
                </span>
              );
            })}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {asOfParts ? (
            <div className="flex items-center gap-2 rounded-sm border border-surface-200 bg-surface-50 px-3 py-1.5">
              <span className="overline text-slate-400">As of</span>
              <span className="font-serif text-sm text-brand-700" style={{ fontVariationSettings: '"opsz" 18, "wght" 500' }}>
                {asOfParts.month}
              </span>
              <span className="font-mono text-xs text-slate-600 num">
                {asOfParts.day}·{asOfParts.year}
              </span>
            </div>
          ) : null}
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
