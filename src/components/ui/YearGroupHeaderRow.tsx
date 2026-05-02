"use client";

import { cn } from "@/lib/utils";

type Props = {
  yearGroups: { year: string; count: number }[];
  leadingClassName?: string;
  children?: React.ReactNode;
};

export function YearGroupHeaderRow({ yearGroups, leadingClassName, children }: Props): JSX.Element | null {
  if (yearGroups.length <= 1) return null;
  return (
    <tr className="bg-brand-700">
      <th className={cn("sticky left-0 z-10 bg-brand-700 py-0.5 border-r border-white/10", leadingClassName)} />
      {yearGroups.map(({ year, count }, idx) => (
        <th
          key={year}
          colSpan={count}
          className={cn(
            "py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-white/30",
            idx > 0 && "border-l border-white/15"
          )}
        >
          {year}
        </th>
      ))}
      {children}
    </tr>
  );
}
