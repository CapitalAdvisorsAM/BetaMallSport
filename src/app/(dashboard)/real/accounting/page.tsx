import { redirect } from "next/navigation";
import { EerrClient } from "@/components/real/EerrClient";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

export default async function FinanceEerrPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
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
      canEdit={canWrite(session.user.role)}
      currentUserId={session.user.id}
      isAdmin={session.user.role === "ADMIN"}
    />
  );
}
