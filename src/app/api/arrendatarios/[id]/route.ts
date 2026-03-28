import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const tenantSchema = z.object({
  proyectoId: z.string().min(1),
  rut: z.string().trim().min(1, "RUT es obligatorio."),
  razonSocial: z.string().trim().min(1, "Razon social es obligatoria."),
  nombreComercial: z.string().trim().min(1, "Nombre comercial es obligatorio."),
  vigente: z.boolean(),
  email: z.string().trim().email("Email invalido.").nullable(),
  telefono: z.string().trim().nullable()
});

function normalizeRut(value: string): string {
  return value.replace(/\./g, "").toUpperCase();
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
    const existing = await prisma.arrendatario.findUnique({
      where: { id: tenantId },
      select: { id: true, proyectoId: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Arrendatario no encontrado." }, { status: 404 });
    }
    if (existing.proyectoId !== payload.proyectoId) {
      return NextResponse.json(
        { message: "El proyecto del payload no coincide con el arrendatario existente." },
        { status: 400 }
      );
    }

    const updated = await prisma.arrendatario.update({
      where: { id: tenantId },
      data: {
        rut: normalizeRut(payload.rut),
        razonSocial: payload.razonSocial,
        nombreComercial: payload.nombreComercial,
        vigente: payload.vigente,
        email: payload.email || null,
        telefono: payload.telefono || null
      }
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "Ya existe un arrendatario con ese RUT para el proyecto seleccionado." },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "No fue posible actualizar el arrendatario." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const tenantId = context.params.id;
    await prisma.arrendatario.delete({ where: { id: tenantId } });
    return NextResponse.json({ message: "Arrendatario eliminado correctamente." });
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { message: "No se puede eliminar el arrendatario porque tiene contratos relacionados." },
        { status: 409 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "Arrendatario no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ message: "No fue posible eliminar el arrendatario." }, { status: 500 });
  }
}
