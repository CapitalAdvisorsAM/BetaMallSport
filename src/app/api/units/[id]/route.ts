export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getProjectIdFromRequest, withNormalizedProjectId } from "@/lib/http/request";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { unitSchema } from "@/lib/units/schema";
import { deleteUnit, getUnitById, updateUnit } from "@/lib/units/unit-service";

export const runtime = "nodejs";

function getRequiredProjectId(request: Request): string {
  const projectId = getProjectIdFromRequest(request);
  if (!projectId) {
    throw new ApiError(400, "projectId es obligatorio.");
  }
  return projectId;
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const projectId = getRequiredProjectId(request);

    const item = await getUnitById({ projectId, unitId: context.params.id });
    if (!item) {
      throw new ApiError(404, "No encontrado.");
    }
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const result = unitSchema.safeParse(withNormalizedProjectId(await request.json()));
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const payload = result.data;
    const unitId = context.params.id;
    const updated = await updateUnit({ unitId, payload });
    invalidateMetricsCacheByProject(payload.proyectoId);

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const projectId = getRequiredProjectId(request);

    const unitId = context.params.id;
    await deleteUnit({ projectId, unitId });
    invalidateMetricsCacheByProject(projectId);

    return NextResponse.json({ message: "Local eliminado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}
