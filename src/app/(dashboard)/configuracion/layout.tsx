import type { ReactNode } from "react";
import { DashboardModuleLayout } from "@/components/layout/DashboardModuleLayout";
import { SettingsSubNav } from "@/components/settings/SettingsSubNav";

export default function ConfiguracionLayout({ children }: { children: ReactNode }): JSX.Element {
  return <DashboardModuleLayout subNav={<SettingsSubNav />}>{children}</DashboardModuleLayout>;
}
