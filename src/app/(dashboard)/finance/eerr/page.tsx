import { redirect } from "next/navigation";
import { EerrClient } from "@/components/finance/EerrClient";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

export default async function FinanceEerrPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  const project = await prisma.project.findFirst({
    where: { id: selectedProjectId },
    select: { glaTotal: true },
  });
  const glaTotal = project?.glaTotal ? Number(project.glaTotal) : null;

  return (
    <EerrClient
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
      glaTotal={glaTotal}
    />
  );
}
