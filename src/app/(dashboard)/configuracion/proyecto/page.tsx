import { redirect } from "next/navigation";
import { ProjectSettingsClient } from "@/components/settings/ProjectSettingsClient";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

export default async function ProyectoConfigPage({
  searchParams
}: {
  searchParams: { project?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.project);

  if (!selectedProjectId) {
    redirect("/rent-roll/projects");
  }

  if (searchParams.project !== selectedProjectId) {
    redirect(`/configuracion/proyecto?project=${selectedProjectId}`);
  }

  const project = await prisma.project.findFirst({
    where: { id: selectedProjectId },
    select: { id: true, nombre: true, color: true, activo: true, slug: true }
  });

  if (!project) {
    redirect("/rent-roll/projects");
  }

  return (
    <ProjectSettingsClient
      project={project}
      canEdit={canWrite(session.user.role)}
      projects={projects}
      selectedProjectId={selectedProjectId}
    />
  );
}
