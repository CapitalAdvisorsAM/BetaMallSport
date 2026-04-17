"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { NavItem } from "@/lib/navigation";
import { isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

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
  preserveQueryKeys = ["project", "proyecto"]
}: ModuleSubNavProps): JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
      {items.filter((item) => item.enabled).map((item) => {
        const active = isNavItemActive(pathname, item.href, item.match);
        const href = buildHref(item.href, searchParams, preserveQueryKeys);

        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              active
                ? "bg-brand-500 font-semibold text-white"
                : "bg-slate-100 font-medium text-slate-700 hover:bg-slate-200 transition-colors",
              isPending && !active && "pointer-events-none opacity-60"
            )}
            onClick={(e) => {
              if (active) return;
              e.preventDefault();
              startTransition(() => router.push(href));
            }}
          >
            {item.label}
          </Link>
        );
      })}
      {isPending && (
        <div className="ml-1 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      )}
    </nav>
  );
}
