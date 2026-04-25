import type { ReactNode } from "react";
import { DashboardModuleLayout } from "@/components/layout/DashboardModuleLayout";
import { ModuleSubNav } from "@/components/navigation/ModuleSubNav";
import { PLAN_SUB_NAV_ITEMS } from "@/lib/navigation";

export default function PlanLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <DashboardModuleLayout
      subNav={<ModuleSubNav items={PLAN_SUB_NAV_ITEMS} preserveQueryKeys={["project", "proyecto"]} />}
    >
      {children}
    </DashboardModuleLayout>
  );
}
