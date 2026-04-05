export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { getProjectIdFromRequest, withNormalizedProjectId } from "@/lib/http/request";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unitSchema } from "@/lib/units/schema";

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

    const item = await prisma.unit.findFirst({
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
    const result = unitSchema.safeParse(withNormalizedProjectId(await request.json()));
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const payload = result.data;
    const unitId = context.params.id;
    const existing = await prisma.unit.findFirst({
      where: { id: unitId, proyectoId: payload.proyectoId },
      select: { id: true, proyectoId: true }
    });

    if (!existing) {
      return NextResponse.json({ message: "Local no encontrado." }, { status: 404 });
    }

    const duplicatedUnit = await prisma.unit.findFirst({
      where: {
        proyectoId: payload.proyectoId,
        id: { not: unitId },
        codigo: {
          equals: payload.codigo,
          mode: "insensitive"
        }
      },
      select: { id: true }
    });
    if (duplicatedUnit) {
      return NextResponse.json(
        { message: "Ya existe un local con ese codigo en este proyecto." },
        { status: 409 }
      );
    }

    const updated = await prisma.unit.update({
      where: { id: unitId },
      data: {
        codigo: payload.codigo,
        nombre: payload.nombre,
        glam2: new Prisma.Decimal(payload.glam2),
        piso: payload.piso,
        tipo: payload.tipo,
        zona: payload.zona || null,
        esGLA: payload.esGLA,
        estado: payload.estado
      }
    });
    invalidateMetricsCacheByProject(payload.proyectoId);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "Ya existe un local con ese codigo en este proyecto." },
        { status: 409 }
      );
    }
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
    const deleted = await prisma.unit.deleteMany({
      where: { id: unitId, proyectoId: projectId }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Local no encontrado." }, { status: 404 });
    }
    invalidateMetricsCacheByProject(projectId);

    return NextResponse.json({ message: "Local eliminado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}
