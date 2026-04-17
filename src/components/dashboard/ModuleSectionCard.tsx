import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModuleSectionCardProps = {
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function ModuleSectionCard({
  title,
  description,
  headerAction,
  children,
  className = "",
  bodyClassName = ""
}: ModuleSectionCardProps): JSX.Element {
  return (
    <section className={cn("overflow-hidden rounded-md border border-slate-200 bg-white shadow", className)}>
      {title || description || headerAction ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3">
          <div>
            {title ? (
              <h3 className="text-sm font-semibold tracking-tight text-brand-700">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          {headerAction}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
