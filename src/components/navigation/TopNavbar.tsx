"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOP_NAV_ITEMS } from "@/lib/navigation";

function isActive(pathname: string, href: string, match: "exact" | "startsWith"): boolean {
  if (match === "exact") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNavbar(): JSX.Element {
  const pathname = usePathname();
  const visibleItems = TOP_NAV_ITEMS.filter((item) => item.enabled);

  return (
    <nav className="flex items-center gap-3 text-sm">
      {visibleItems.map((item) => {
        const active = isActive(pathname, item.href, item.match);
        return (
          <Link
            key={item.href}
            className={
              active
                ? "rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            }
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
