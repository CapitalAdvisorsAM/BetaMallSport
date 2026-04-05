"use client";

import { ModuleSubNav } from "@/components/navigation/ModuleSubNav";
import { CONFIGURACION_SUB_NAV_ITEMS } from "@/lib/navigation";

export function ConfiguracionSubNav(): JSX.Element {
  return <ModuleSubNav items={CONFIGURACION_SUB_NAV_ITEMS} preserveQueryKeys={["project", "proyecto"]} />;
}
