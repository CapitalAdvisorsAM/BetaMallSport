import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSelectedProjectCookie } from "@/lib/project-cookie";

export const ACTIVE_PROJECTS_TAG = "active-projects";

const getCachedProjects = unstable_cache(
  () =>
    prisma.project.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, slug: true, reportDate: true }
    }),
  [ACTIVE_PROJECTS_TAG],
  { revalidate: 60, tags: [ACTIVE_PROJECTS_TAG] }
);

export const getActiveProjects = cache(async () => getCachedProjects());

export const getProjectContext = cache(async () => {
  const projects = await getCachedProjects();
  const cookieProjectId = getSelectedProjectCookie();

  const selectedProjectId =
    cookieProjectId && projects.some((project) => project.id === cookieProjectId)
      ? cookieProjectId
      : "";

  return { projects, selectedProjectId };
});
