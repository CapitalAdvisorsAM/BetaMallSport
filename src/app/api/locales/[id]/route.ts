import { EstadoMaestro, LocalTipo, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const localeSchema = z.object({
  proyectoId: z.string().min(1),
  codigo: z.string().trim().min(1, "Codigo es obligatorio."),
  nombre: z.string().trim().min(1, "Nombre es obligatorio."),
  glam2: z
    .string()
    .trim()
    .min(1)
    .refine((value) => {
      try {
        // eslint-disable-next-line no-new
        new Prisma.Decimal(value);
        return true;
      } catch {
        return false;
      }
    }, "GLA m2 debe ser numerico."),
  piso: z.string().trim().min(1, "Piso es obligatorio."),
  tipo: z.nativeEnum(LocalTipo),
  zona: z.string().trim().nullable(),
  esGLA: z.boolean(),
  estado: z.nativeEnum(EstadoMaestro)
});

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
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "Ya existe un local con ese codigo para el proyecto seleccionado." },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "No fue posible actualizar el local." }, { status: 500 });
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
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "No se puede eliminar el local porque tiene contratos relacionados." },
        { status: 409 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "Local no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ message: "No fue posible eliminar el local." }, { status: 500 });
  }
}
