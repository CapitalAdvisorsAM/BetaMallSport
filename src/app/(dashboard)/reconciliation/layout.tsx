import type { ReactNode } from "react";
import { DashboardModuleLayout } from "@/components/layout/DashboardModuleLayout";
import { ModuleSubNav } from "@/components/navigation/ModuleSubNav";
import { RECON_SUB_NAV_ITEMS } from "@/lib/navigation";

export default function ReconciliationLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <DashboardModuleLayout
      subNav={<ModuleSubNav items={RECON_SUB_NAV_ITEMS} preserveQueryKeys={["project", "proyecto"]} />}
    >
      {children}
    </DashboardModuleLayout>
  );
}
