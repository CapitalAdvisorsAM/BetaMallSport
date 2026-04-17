import { redirect } from "next/navigation";
import { FinanceDashboardClient } from "@/components/finance/FinanceDashboardClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function FinanceDashboardPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  return <FinanceDashboardClient selectedProjectId={selectedProjectId} />;
}
