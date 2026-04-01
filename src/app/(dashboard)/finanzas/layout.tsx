import type { ReactNode } from "react";
import { FinanzasSubNav } from "@/components/finanzas/FinanzasSubNav";

export default function FinanzasLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="space-y-4">
      <section className="rounded-md bg-white px-4 pt-4 shadow-sm">
        <FinanzasSubNav />
      </section>
      {children}
    </div>
  );
}
