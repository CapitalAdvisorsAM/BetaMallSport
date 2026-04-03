"use client";

import { ModuleSubNav } from "@/components/navigation/ModuleSubNav";
import { FINANZAS_SUB_NAV_ITEMS } from "@/lib/navigation";

export function FinanzasSubNav(): JSX.Element {
  return <ModuleSubNav items={FINANZAS_SUB_NAV_ITEMS} preserveQueryKeys={["proyecto"]} />;
}
