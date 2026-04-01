import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession } from "@/lib/permissions";
import { getTimelineData } from "@/lib/rent-roll/timeline";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");
    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId requerido" }, { status: 400 });
    }
    const data = await getTimelineData(proyectoId);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
