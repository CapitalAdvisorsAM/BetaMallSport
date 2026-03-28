"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { HelpDrawer, type HelpSection } from "@/components/ui/HelpDrawer";

function resolveSection(pathname: string): HelpSection {
  if (pathname === "/") {
    return "dashboard";
  }

  if (pathname === "/rent-roll") {
    return "rent-roll";
  }

  if (pathname.startsWith("/rent-roll/locales")) {
    return "locales";
  }

  if (pathname.startsWith("/rent-roll/arrendatarios")) {
    return "arrendatarios";
  }

  if (pathname.startsWith("/rent-roll/contratos")) {
    return "contratos";
  }

  if (pathname.startsWith("/rent-roll/upload")) {
    return "upload";
  }

  if (pathname.startsWith("/rent-roll/dashboard")) {
    return "rent-roll";
  }

  return "dashboard";
}

export function HelpButton(): JSX.Element {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const section = useMemo(() => resolveSection(pathname), [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir ayuda"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-10 w-10 rounded-full bg-brand-700 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
      >
        ?
      </button>
      <HelpDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} section={section} />
    </>
  );
}
