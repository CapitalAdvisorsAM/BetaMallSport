"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOP_NAV_ITEMS, isNavItemActive } from "@/lib/navigation";

export function TopNavbar(): JSX.Element {
  const pathname = usePathname();
  const visibleItems = TOP_NAV_ITEMS.filter((item) => item.enabled);

  return (
    <nav
      aria-label="Navegacion principal"
      className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 text-sm"
    >
      {visibleItems.map((item) => {
        const active = isNavItemActive(pathname, item.href, item.match);
        return (
          <Link
            key={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "whitespace-nowrap rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                : "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
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
