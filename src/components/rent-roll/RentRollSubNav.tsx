"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { RENT_ROLL_SUB_NAV_ITEMS, isNavItemActive } from "@/lib/navigation";

export function RentRollSubNav(): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const proyecto = searchParams.get("proyecto");

  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
      {RENT_ROLL_SUB_NAV_ITEMS.filter((item) => item.enabled).map((item) => {
        const active = isNavItemActive(pathname, item.href, item.match);
        const href = proyecto ? `${item.href}?proyecto=${encodeURIComponent(proyecto)}` : item.href;

        return (
          <Link
            key={item.href}
            href={href}
            className={
              active
                ? "rounded-md bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
