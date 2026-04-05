import { prisma } from "@/lib/prisma";

export function resolveProjectQueryParam(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function resolveProjectIdFromSearchParams(searchParams: {
  project?: string | string[];
  proyecto?: string | string[];
}): string | undefined {
  return (
    resolveProjectQueryParam(searchParams.project) ?? resolveProjectQueryParam(searchParams.proyecto)
  );
}

export async function getProjectContext(projectId?: string) {
  const projects = await prisma.project.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, slug: true }
  });

  const selectedProjectId = projects.some((project) => project.id === projectId)
    ? (projectId as string)
    : (projects[0]?.id ?? "");
  return { projects, selectedProjectId };
}
