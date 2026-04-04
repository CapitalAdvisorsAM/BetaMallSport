export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { localeSchema } from "@/lib/locales/schema";
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

    const item = await prisma.local.findFirst({
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
    const result = localeSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const payload = result.data;
    const localeId = context.params.id;
    const existing = await prisma.local.findFirst({
      where: { id: localeId, proyectoId: payload.proyectoId },
      select: { id: true, proyectoId: true }
    });

    if (!existing) {
      return NextResponse.json({ message: "Local no encontrado." }, { status: 404 });
    }

    const duplicatedLocal = await prisma.local.findFirst({
      where: {
        proyectoId: payload.proyectoId,
        id: { not: localeId },
        codigo: {
          equals: payload.codigo,
          mode: "insensitive"
        }
      },
      select: { id: true }
    });
    if (duplicatedLocal) {
      return NextResponse.json(
        { message: "Ya existe un local con ese codigo en este proyecto." },
        { status: 409 }
      );
    }

    const updated = await prisma.local.update({
      where: { id: localeId },
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
    const proyectoId = getProyectoIdFromRequest(request);
    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const localeId = context.params.id;
    const deleted = await prisma.local.deleteMany({
      where: { id: localeId, proyectoId }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Local no encontrado." }, { status: 404 });
    }
    invalidateMetricsCacheByProject(proyectoId);

    return NextResponse.json({ message: "Local eliminado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}
