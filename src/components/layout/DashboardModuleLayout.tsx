import type { ReactNode } from "react";

type DashboardModuleLayoutProps = {
  subNav: ReactNode;
  children: ReactNode;
};

export function DashboardModuleLayout({
  subNav,
  children
}: DashboardModuleLayoutProps): JSX.Element {
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white px-4 pt-4 shadow">{subNav}</section>
      {children}
    </div>
  );
}
