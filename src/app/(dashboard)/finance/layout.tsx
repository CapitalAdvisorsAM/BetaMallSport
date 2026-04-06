import type { ReactNode } from "react";
import { DashboardModuleLayout } from "@/components/layout/DashboardModuleLayout";
import { FinanceSubNav } from "@/components/finance/FinanceSubNav";

export default function FinanceLayout({ children }: { children: ReactNode }): JSX.Element {
  return <DashboardModuleLayout subNav={<FinanceSubNav />}>{children}</DashboardModuleLayout>;
}


