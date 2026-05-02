import { redirect } from "next/navigation";
import { OccupancyClient } from "@/components/plan/OccupancyClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { toPeriodKey } from "@/lib/real/period-range";

export default async function RentRollOccupancyPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { projects, selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const reportPeriod = selectedProject?.reportDate ? toPeriodKey(selectedProject.reportDate) : undefined;
  const defaultHasta = searchParams.to ?? searchParams.hasta ?? reportPeriod;
  const defaultDesde = searchParams.from ?? searchParams.desde ?? defaultHasta;

  return (
    <OccupancyClient
      selectedProjectId={selectedProjectId}
      defaultDesde={defaultDesde}
      defaultHasta={defaultHasta}
    />
  );
}
