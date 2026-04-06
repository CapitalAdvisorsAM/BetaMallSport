import type { ReactNode } from "react";
import { DashboardModuleLayout } from "@/components/layout/DashboardModuleLayout";
import { ConfiguracionSubNav } from "@/components/configuracion/ConfiguracionSubNav";

export default function ConfiguracionLayout({ children }: { children: ReactNode }): JSX.Element {
  return <DashboardModuleLayout subNav={<ConfiguracionSubNav />}>{children}</DashboardModuleLayout>;
}
