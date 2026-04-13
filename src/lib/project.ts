import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { resolveProjectIdFromQuery } from "@/lib/project-query";

export const ACTIVE_PROJECTS_TAG = "active-projects";

export function resolveProjectQueryParam(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function resolveProjectIdFromSearchParams(searchParams: {
  project?: string | string[];
}): string | undefined {
  return resolveProjectIdFromQuery({
    project: resolveProjectQueryParam(searchParams.project),
  });
}

const getCachedProjects = unstable_cache(
  () =>
    prisma.project.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, slug: true }
    }),
  [ACTIVE_PROJECTS_TAG],
  { revalidate: 60, tags: [ACTIVE_PROJECTS_TAG] }
);

export const getProjectContext = cache(async (projectId?: string) => {
  const projects = await getCachedProjects();

  const selectedProjectId = projects.some((project) => project.id === projectId)
    ? (projectId as string)
    : (projects[0]?.id ?? "");
  return { projects, selectedProjectId };
});
