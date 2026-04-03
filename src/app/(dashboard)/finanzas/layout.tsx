import type { ReactNode } from "react";
import { DashboardModuleLayout } from "@/components/layout/DashboardModuleLayout";
import { FinanzasSubNav } from "@/components/finanzas/FinanzasSubNav";

export default function FinanzasLayout({ children }: { children: ReactNode }): JSX.Element {
  return <DashboardModuleLayout subNav={<FinanzasSubNav />}>{children}</DashboardModuleLayout>;
}
