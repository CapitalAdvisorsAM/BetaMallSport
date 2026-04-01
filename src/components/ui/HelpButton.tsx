"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { HelpDrawer, type HelpSection } from "@/components/ui/HelpDrawer";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        size="icon"
        variant="default"
        aria-label="Abrir ayuda"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full shadow-lg"
      >
        <HelpCircle className="h-5 w-5" />
        <span className="sr-only">Abrir ayuda</span>
      </Button>
      <HelpDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} section={section} />
    </>
  );
}
