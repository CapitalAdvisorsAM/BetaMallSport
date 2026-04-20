"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { TOP_NAV_ITEMS, isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function TopNavbar(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const visibleItems = TOP_NAV_ITEMS.filter((item) => item.enabled);

  return (
    <nav
      aria-label="Navegacion principal"
      className="flex max-w-full items-center gap-2 overflow-hidden text-sm"
    >
      {visibleItems.map((item) => {
        const active = isNavItemActive(pathname, item.href, item.match);
        return (
          <Link
            key={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative whitespace-nowrap px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400",
              "after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:origin-left after:scale-x-0 after:bg-gold-400 after:transition-transform after:duration-200 after:ease-out",
              active
                ? "font-semibold text-white after:scale-x-100"
                : "font-medium text-white/70 hover:text-white hover:after:scale-x-100",
              isPending && "pointer-events-none opacity-60"
            )}
            href={item.href}
            onClick={(e) => {
              if (active) return;
              e.preventDefault();
              startTransition(() => router.push(item.href));
            }}
          >
            {item.label}
          </Link>
        );
      })}
      {isPending && (
        <div className="ml-1 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
    </nav>
  );
}
