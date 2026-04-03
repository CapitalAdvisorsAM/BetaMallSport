import type { ReactNode } from "react";
import { DashboardModuleLayout } from "@/components/layout/DashboardModuleLayout";
import { RentRollSubNav } from "@/components/rent-roll/RentRollSubNav";

export default function RentRollLayout({
  children
}: {
  children: ReactNode;
}): JSX.Element {
  return <DashboardModuleLayout subNav={<RentRollSubNav />}>{children}</DashboardModuleLayout>;
}
