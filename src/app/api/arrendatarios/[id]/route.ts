import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { normalizeRut, tenantSchema } from "@/lib/arrendatarios/schema";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const item = await prisma.arrendatario.findUnique({
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
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  try {
    await requireWriteAccess();
    const tenantId = context.params.id;
    await prisma.arrendatario.delete({ where: { id: tenantId } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
