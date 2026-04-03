"use client";

import { ModuleSubNav } from "@/components/navigation/ModuleSubNav";
import { RENT_ROLL_SUB_NAV_ITEMS } from "@/lib/navigation";

export function RentRollSubNav(): JSX.Element {
  return <ModuleSubNav items={RENT_ROLL_SUB_NAV_ITEMS} preserveQueryKeys={["proyecto"]} />;
}
