import { redirect } from "next/navigation";
import { ProjectSettingsClient } from "@/components/settings/ProjectSettingsClient";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

export default async function ProyectoConfigPage(): Promise<JSX.Element> {
  const session = await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/settings/projects");
  }

  const projectRaw = await prisma.project.findFirst({
    where: { id: selectedProjectId },
    select: { id: true, nombre: true, color: true, activo: true, slug: true, glaTotal: true }
  });

  if (!projectRaw) {
    redirect("/settings/projects");
  }

  const project = { ...projectRaw, glaTotal: projectRaw.glaTotal?.toString() ?? null };

  return (
    <ProjectSettingsClient
      project={project}
      canEdit={canWrite(session.user.role)}
    />
  );
}
