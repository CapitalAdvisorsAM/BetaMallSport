"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { NavItem } from "@/lib/navigation";
import { isNavItemActive } from "@/lib/navigation";

type ModuleSubNavProps = {
  items: NavItem[];
  preserveQueryKeys?: string[];
};

function buildHref(
  baseHref: string,
  searchParams: URLSearchParams,
  preserveQueryKeys: string[]
): string {
  const params = new URLSearchParams();

  preserveQueryKeys.forEach((key) => {
    const value = searchParams.get(key);
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `${baseHref}?${queryString}` : baseHref;
}

export function ModuleSubNav({
  items,
  preserveQueryKeys = ["proyecto"]
}: ModuleSubNavProps): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
      {items.filter((item) => item.enabled).map((item) => {
        const active = isNavItemActive(pathname, item.href, item.match);
        const href = buildHref(item.href, searchParams, preserveQueryKeys);

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
