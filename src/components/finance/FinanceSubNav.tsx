"use client";

import { ModuleSubNav } from "@/components/navigation/ModuleSubNav";
import { FINANCE_SUB_NAV_ITEMS } from "@/lib/navigation";

export function FinanceSubNav(): JSX.Element {
  return <ModuleSubNav items={FINANCE_SUB_NAV_ITEMS} preserveQueryKeys={["project", "proyecto"]} />;
}
