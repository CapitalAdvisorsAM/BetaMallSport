"use client";

import { ModuleSubNav } from "@/components/navigation/ModuleSubNav";
import { SETTINGS_SUB_NAV_ITEMS } from "@/lib/navigation";

export function SettingsSubNav(): JSX.Element {
  return <ModuleSubNav items={SETTINGS_SUB_NAV_ITEMS} preserveQueryKeys={["project", "proyecto"]} />;
}
