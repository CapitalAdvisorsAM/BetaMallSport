import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModuleSectionCardProps = {
  title?: string;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "default" | "plain";
};

export function ModuleSectionCard({
  title,
  description,
  headerAction,
  children,
  className = "",
  bodyClassName = "",
  tone = "default"
}: ModuleSectionCardProps): JSX.Element {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border bg-white",
        tone === "default" ? "border-surface-200 shadow-card" : "border-transparent",
        className
      )}
    >
      {title || description || headerAction ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-200 bg-surface-50/60 px-5 py-3">
          <div className="min-w-0">
            {title ? (
              <h3 className="overline text-brand-700">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          {headerAction ? (
            <div className="flex flex-wrap items-center gap-2">{headerAction}</div>
          ) : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
