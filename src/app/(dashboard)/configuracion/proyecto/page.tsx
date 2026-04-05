import { redirect } from "next/navigation";
import { ProyectoConfigClient } from "@/components/configuracion/ProyectoConfigClient";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

export default async function ProyectoConfigPage({
  searchParams
}: {
  searchParams: { proyecto?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    redirect("/rent-roll/projects");
  }

  if (searchParams.proyecto !== selectedProjectId) {
    redirect(`/configuracion/proyecto?proyecto=${selectedProjectId}`);
  }

  const project = await prisma.project.findFirst({
    where: { id: selectedProjectId },
    select: { id: true, nombre: true, color: true, activo: true, slug: true }
  });

  if (!project) {
    redirect("/rent-roll/projects");
  }

  return (
    <ProyectoConfigClient
      project={project}
      canEdit={canWrite(session.user.role)}
      projects={projects}
      selectedProjectId={selectedProjectId}
    />
  );
}
