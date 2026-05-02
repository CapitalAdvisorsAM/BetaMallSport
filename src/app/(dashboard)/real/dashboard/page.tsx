import { redirect } from "next/navigation";
import { FinanceDashboardClient } from "@/components/real/FinanceDashboardClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

function dateToPeriodo(date: Date | string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
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
