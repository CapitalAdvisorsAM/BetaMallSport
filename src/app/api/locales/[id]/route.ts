import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { localeSchema } from "@/lib/locales/schema";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const item = await prisma.local.findUnique({
      where: { id: context.params.id }
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
    const existing = await prisma.local.findUnique({
      where: { id: localeId },
      select: { id: true, proyectoId: true }
    });

    if (!existing) {
      return NextResponse.json({ message: "Local no encontrado." }, { status: 404 });
    }
    if (existing.proyectoId !== payload.proyectoId) {
      return NextResponse.json(
        { message: "El proyecto del payload no coincide con el local existente." },
        { status: 400 }
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

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const localeId = context.params.id;
    await prisma.local.delete({ where: { id: localeId } });
    return NextResponse.json({ message: "Local eliminado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}
