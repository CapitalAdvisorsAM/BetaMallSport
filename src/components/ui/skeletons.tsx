import { cn } from "@/lib/utils";

type KpiCardSkeletonProps = {
  accent?: "green" | "yellow" | "red" | "slate";
};

const accentStyles: Record<string, string> = {
  green: "border-t-2 border-t-emerald-500",
  yellow: "border-t-2 border-t-gold-400",
  red: "border-t-2 border-t-rose-500",
  slate: "border-t-2 border-t-brand-500",
};

export function KpiCardSkeleton({ accent = "slate" }: KpiCardSkeletonProps): JSX.Element {
  return (
    <article className={cn("rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow", accentStyles[accent])}>
      <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-9 w-32 animate-pulse rounded bg-slate-100" />
      <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-slate-100" />
    </article>
  );
}

type ChartCardSkeletonProps = {
  height?: string;
};

export function ChartCardSkeleton({ height = "h-48" }: ChartCardSkeletonProps): JSX.Element {
  return (
    <article className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
        <div className="mt-1 h-3 w-48 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="p-4">
        <div className={cn("animate-pulse rounded bg-slate-100", height)} />
      </div>
    </article>
  );
}

type TableSkeletonProps = {
  rows?: number;
  cols?: number;
};

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="bg-brand-700 px-3 py-2.5">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 w-20 animate-pulse rounded bg-white/20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-3 py-2.5">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-4 w-20 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type SubNavSkeletonProps = {
  items?: number;
};

export function SubNavSkeleton({ items = 4 }: SubNavSkeletonProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 pb-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="h-8 w-20 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

export function TitleSkeleton(): JSX.Element {
  return <div className="h-7 w-48 animate-pulse rounded-md bg-slate-100" />;
}
