import { redirect } from "next/navigation";
import { requireSession } from "@/lib/permissions";

export default async function DashboardIndexPage(): Promise<never> {
  await requireSession();
  redirect("/plan/dashboard");
}
