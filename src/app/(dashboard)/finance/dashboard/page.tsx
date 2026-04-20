import { redirect } from "next/navigation";
import { FinanceDashboardClient } from "@/components/finance/FinanceDashboardClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

function dateToPeriodo(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default async function FinanceDashboardPage(): Promise<JSX.Element> {
  await requireSession();
  const { projects, selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const reportDate = dateToPeriodo(selectedProject?.reportDate ?? null);

  return <FinanceDashboardClient selectedProjectId={selectedProjectId} reportDate={reportDate} />;
}
