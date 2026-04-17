import type { ReactNode } from "react";

type ValueBadge = "teorico" | "efectivo";

const VALUE_BADGE_CONFIG: Record<ValueBadge, { label: string; className: string }> = {
  teorico: { label: "Teórico", className: "bg-amber-100 text-amber-700" },
  efectivo: { label: "Efectivo", className: "bg-emerald-100 text-emerald-700" },
};

type ModuleHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  valueBadges?: ValueBadge[];
};

export function ModuleHeader({ title, description, actions, valueBadges }: ModuleHeaderProps): JSX.Element {
  return (
    <header className="rounded-md bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="h-5 w-1 rounded-full bg-gold-400" />
            <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">{title}</h2>
            {valueBadges?.map((badge) => {
              const cfg = VALUE_BADGE_CONFIG[badge];
              return (
                <span key={badge} className={`rounded px-1.5 py-0.5 text-xs font-medium ${cfg.className}`}>
                  {cfg.label}
                </span>
              );
            })}
          </div>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
