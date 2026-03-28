import { prisma } from "@/lib/prisma";

export async function getProjectContext(projectId?: string) {
  const projects = await prisma.proyecto.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, slug: true }
  });

  const selectedProjectId = projects.some((project) => project.id === projectId)
    ? (projectId as string)
    : (projects[0]?.id ?? "");
  return { projects, selectedProjectId };
}
