import type { ReactNode } from "react";

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
    <section className={`overflow-hidden rounded-md bg-white shadow-sm ${className}`.trim()}>
      {title || description || headerAction ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            {title ? <h3 className="text-sm font-semibold text-brand-700">{title}</h3> : null}
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          {headerAction}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
