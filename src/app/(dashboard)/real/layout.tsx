import type { ReactNode } from "react";
import { DashboardModuleLayout } from "@/components/layout/DashboardModuleLayout";
import { ModuleSubNav } from "@/components/navigation/ModuleSubNav";
import { REAL_SUB_NAV_ITEMS } from "@/lib/navigation";

export default function RealLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <DashboardModuleLayout
      subNav={<ModuleSubNav items={REAL_SUB_NAV_ITEMS} preserveQueryKeys={["project", "proyecto"]} />}
    >
      {children}
    </DashboardModuleLayout>
  );
}
