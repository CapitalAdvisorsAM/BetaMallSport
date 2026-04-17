export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { setSelectedProjectCookie } from "@/lib/project-cookie";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) throw new ApiError(400, "projectId es obligatorio.");

    const project = await prisma.project.findFirst({
      where: { id: projectId, activo: true },
      select: { id: true },
    });

    if (!project) throw new ApiError(404, "Proyecto no encontrado.");

    setSelectedProjectCookie(project.id);

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    return handleApiError(error);
  }
}
