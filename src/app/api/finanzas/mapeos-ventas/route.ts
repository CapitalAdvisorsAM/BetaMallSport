import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession, requireWriteAccess } from "@/lib/permissions";

const createSchema = z.object({
  proyectoId: z.string().uuid(),
  idCa: z.number().int(),
  tiendaNombre: z.string().min(1),
  localId: z.string().uuid()
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    if (!proyectoId) throw new ApiError(400, "proyectoId requerido.");

    const [mapeos, locales] = await Promise.all([
      prisma.mapeoVentasLocal.findMany({
        where: { proyectoId },
        include: { local: { select: { codigo: true, nombre: true } } },
        orderBy: { tiendaNombre: "asc" }
      }),
      prisma.local.findMany({
        where: { proyectoId, estado: "ACTIVO" },
        select: { id: true, codigo: true, nombre: true },
        orderBy: { codigo: "asc" }
      })
    ]);

    return NextResponse.json({ mapeos, locales });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const body = await req.json();
    const result = createSchema.safeParse(body);
    if (!result.success) throw new ApiError(400, "Datos inválidos.");

    const { proyectoId, idCa, tiendaNombre, localId } = result.data;

    const mapeo = await prisma.mapeoVentasLocal.upsert({
      where: { proyectoId_idCa: { proyectoId, idCa } },
      update: { localId, tiendaNombre, creadoPor: session.user.id },
      create: { proyectoId, idCa, tiendaNombre, localId, creadoPor: session.user.id }
    });

    return NextResponse.json(mapeo, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) throw new ApiError(400, "id requerido.");
    await prisma.mapeoVentasLocal.delete({ where: { id } });
    return NextResponse.json({ message: "Eliminado." });
  } catch (error) {
    return handleApiError(error);
  }
}
