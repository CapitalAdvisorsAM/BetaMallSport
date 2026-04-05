export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getProjectIdFromRequest, withNormalizedProjectId } from "@/lib/http/request";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveTenantRut, tenantSchema } from "@/lib/tenants/schema";

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

    const item = await prisma.tenant.findFirst({
      where: { id: context.params.id, proyectoId: projectId }
    });
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
    const result = tenantSchema.safeParse(withNormalizedProjectId(await request.json()));
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const payload = result.data;
    const tenantId = context.params.id;
    const existing = await prisma.tenant.findFirst({
      where: { id: tenantId, proyectoId: payload.proyectoId },
      select: { id: true, proyectoId: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Arrendatario no encontrado." }, { status: 404 });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        rut: resolveTenantRut(payload.rut, payload.razonSocial, payload.nombreComercial),
        razonSocial: payload.razonSocial,
        nombreComercial: payload.nombreComercial,
        vigente: payload.vigente,
        email: payload.email || null,
        telefono: payload.telefono || null
      }
    });
    invalidateMetricsCacheByProject(payload.proyectoId);
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

    const tenantId = context.params.id;
    const deleted = await prisma.tenant.deleteMany({
      where: { id: tenantId, proyectoId: projectId }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Arrendatario no encontrado." }, { status: 404 });
    }
    invalidateMetricsCacheByProject(projectId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
