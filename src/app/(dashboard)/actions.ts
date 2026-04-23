"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  clearSelectedProjectCookie,
  setSelectedProjectCookie
} from "@/lib/project-cookie";

export async function selectProjectAction(projectId: string): Promise<never> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, activo: true },
    select: { id: true }
  });

  if (!project) {
    clearSelectedProjectCookie();
    redirect("/");
  }

  setSelectedProjectCookie(project.id);
  redirect("/plan/dashboard");
}

export async function clearSelectedProjectAction(): Promise<never> {
  clearSelectedProjectCookie();
  redirect("/");
}
