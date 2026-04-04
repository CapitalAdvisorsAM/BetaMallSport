export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { resolveTenantRut, tenantSchema } from "@/lib/arrendatarios/schema";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function getProyectoIdFromRequest(request: Request): string | null {
  const proyectoId = new URL(request.url).searchParams.get("proyectoId")?.trim() ?? "";
  return proyectoId.length > 0 ? proyectoId : null;
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const proyectoId = getProyectoIdFromRequest(request);
    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const item = await prisma.arrendatario.findFirst({
      where: { id: context.params.id, proyectoId }
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
    const result = tenantSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const payload = result.data;
    const tenantId = context.params.id;
    const existing = await prisma.arrendatario.findFirst({
      where: { id: tenantId, proyectoId: payload.proyectoId },
      select: { id: true, proyectoId: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Arrendatario no encontrado." }, { status: 404 });
    }

    const updated = await prisma.arrendatario.update({
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
    const proyectoId = getProyectoIdFromRequest(request);
    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const tenantId = context.params.id;
    const deleted = await prisma.arrendatario.deleteMany({
      where: { id: tenantId, proyectoId }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Arrendatario no encontrado." }, { status: 404 });
    }
    invalidateMetricsCacheByProject(proyectoId);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
