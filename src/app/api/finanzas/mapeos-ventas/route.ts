import { NextRequest, NextResponse } from "next/server";
import { getActiveLocales, getVentasMapeos, upsertVentasMapeo, ventasMapeoSchema } from "@/lib/finanzas/mapeos";
import { handleApiError, ApiError } from "@/lib/api-error";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get("proyectoId");
    if (!proyectoId) {
      throw new ApiError(400, "proyectoId requerido.");
    }

    const [mapeos, locales] = await Promise.all([
      getVentasMapeos(proyectoId),
      getActiveLocales(proyectoId)
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
    const result = ventasMapeoSchema.safeParse(body);
    if (!result.success) {
      throw new ApiError(400, "Datos invalidos.");
    }

    const mapeo = await upsertVentasMapeo(result.data, session.user.id);
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
    if (!id) {
      throw new ApiError(400, "id requerido.");
    }

    await prisma.mapeoVentasLocal.delete({ where: { id } });
    return NextResponse.json({ message: "Eliminado." });
  } catch (error) {
    return handleApiError(error);
  }
}
