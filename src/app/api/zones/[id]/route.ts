export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getProjectIdFromRequest, withNormalizedProjectId } from "@/lib/http/request";
import { requireWriteAccess } from "@/lib/permissions";
import { zoneSchema } from "@/lib/zones/schema";
import { deleteZone, updateZone } from "@/lib/zones/zone-service";

export const runtime = "nodejs";

function getRequiredProjectId(request: Request): string {
  const projectId = getProjectIdFromRequest(request);
  if (!projectId) {
    throw new ApiError(400, "projectId es obligatorio.");
  }
  return projectId;
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const result = zoneSchema.safeParse(withNormalizedProjectId(await request.json()));
    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0]?.message ?? "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const updated = await updateZone({
      zoneId: context.params.id,
      projectId: result.data.proyectoId,
      nombre: result.data.nombre
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  try {
    await requireWriteAccess();
    const projectId = getRequiredProjectId(request);

    await deleteZone({ zoneId: context.params.id, projectId });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
