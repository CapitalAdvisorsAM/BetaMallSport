"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
