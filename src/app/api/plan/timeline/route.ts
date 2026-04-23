export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { getTimelineData } from "@/lib/plan/timeline";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("projectId");
    if (!proyectoId) {
      return NextResponse.json({ message: "projectId requerido" }, { status: 400 });
    }
    const data = await getTimelineData(proyectoId);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
