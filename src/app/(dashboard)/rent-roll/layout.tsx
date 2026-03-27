import type { ReactNode } from "react";
import { RentRollSubNav } from "@/components/rent-roll/RentRollSubNav";

export default function RentRollLayout({
  children
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white px-4 pt-4 shadow-sm">
        <RentRollSubNav />
      </section>
      {children}
    </div>
  );
}
