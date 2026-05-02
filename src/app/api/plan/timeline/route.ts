export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { getTimelineData } from "@/lib/plan/timeline";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("projectId");
    if (!proyectoId) {
      return NextResponse.json({ message: "projectId requerido" }, { status: 400 });
    }
    const project = await prisma.project.findUnique({
      where: { id: proyectoId },
      select: { reportDate: true }
    });
    const data = await getTimelineData(proyectoId, project?.reportDate ?? new Date());
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
