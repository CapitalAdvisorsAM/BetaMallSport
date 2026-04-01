export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const projectUpdateSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color invalido. Usa formato hexadecimal #RRGGBB."),
  activo: z.boolean()
});

function slugify(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "proyecto";
}

async function buildUniqueSlug(baseSlug: string, excludeId: string): Promise<string> {
  let candidate = baseSlug;
  let index = 2;
  while (true) {
    const exists = await prisma.proyecto.findFirst({
      where: {
        slug: candidate,
        id: { not: excludeId }
      },
      select: { id: true }
    });
    if (!exists) {
      return candidate;
    }
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const item = await prisma.proyecto.findUnique({
      where: { id: context.params.id },
      select: { id: true, nombre: true, slug: true, color: true, activo: true }
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
    const projectId = context.params.id;

    const existing = await prisma.proyecto.findUnique({
      where: { id: projectId },
      select: { id: true, nombre: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Proyecto no encontrado." }, { status: 404 });
    }

    const result = projectUpdateSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const payload = result.data;
    const slug =
      payload.nombre === existing.nombre
        ? undefined
        : await buildUniqueSlug(slugify(payload.nombre), projectId);

    const updated = await prisma.proyecto.update({
      where: { id: projectId },
      data: {
        nombre: payload.nombre,
        color: payload.color,
        activo: payload.activo,
        ...(slug ? { slug } : {})
      },
      select: { id: true, nombre: true, slug: true, color: true, activo: true }
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
    const projectId = context.params.id;

    const project = await prisma.proyecto.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        _count: {
          select: {
            locales: true,
            arrendatarios: true,
            contratos: true,
            contratosDia: true,
            cargasDatos: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ message: "Proyecto no encontrado." }, { status: 404 });
    }

    const relatedRows =
      project._count.locales +
      project._count.arrendatarios +
      project._count.contratos +
      project._count.contratosDia +
      project._count.cargasDatos;

    if (relatedRows > 0) {
      return NextResponse.json(
        {
          message:
            "No se puede eliminar el proyecto porque tiene datos asociados. Desactivalo en lugar de eliminarlo."
        },
        { status: 409 }
      );
    }

    await prisma.proyecto.delete({
      where: { id: projectId }
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
