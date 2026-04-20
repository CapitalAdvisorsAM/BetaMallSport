import { cn } from "@/lib/utils";

type ModuleLoadingStateProps = {
  message?: string;
  shape?: "generic" | "table" | "chart" | "kpis";
};

function SkeletonBar({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "animate-pulse rounded-sm bg-gradient-to-r from-surface-100 via-surface-200/80 to-surface-100",
        className
      )}
    />
  );
}

export function ModuleLoadingState({
  message = "Cargando...",
  shape = "generic"
}: ModuleLoadingStateProps): JSX.Element {
  if (shape === "kpis") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 p-4" aria-busy="true" aria-label={message}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border border-surface-200 bg-white p-4 shadow-card">
            <SkeletonBar className="h-3 w-1/2" />
            <SkeletonBar className="mt-2 h-6 w-2/3" />
            <SkeletonBar className="mt-2 h-2.5 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (shape === "chart") {
    return (
      <div className="p-4" aria-busy="true" aria-label={message}>
        <SkeletonBar className="h-3 w-40" />
        <div className="mt-4 flex h-[220px] items-end gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonBar
              key={i}
              className="flex-1"
              // deterministic heights so SSR/CSR agree
              // eslint-disable-next-line react/forbid-dom-props
            />
          ))}
        </div>
      </div>
    );
  }

  if (shape === "table") {
    return (
      <div className="p-4" aria-busy="true" aria-label={message}>
        <SkeletonBar className="h-3 w-32" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((__, j) => (
                <SkeletonBar key={j} className="h-4" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-40 items-center justify-center text-sm text-slate-500" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand-500/60" aria-hidden />
        {message}
      </div>
    </div>
  );
}
