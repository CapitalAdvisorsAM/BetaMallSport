import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { normalizeRut, tenantSchema } from "@/lib/arrendatarios/schema";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");

    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const paginationRequested = searchParams.has("limit") || searchParams.has("cursor");
    if (!paginationRequested) {
      const arrendatarios = await prisma.arrendatario.findMany({
        where: { proyectoId },
        orderBy: { nombreComercial: "asc" }
      });
      return NextResponse.json(arrendatarios);
    }

    const parsedLimit = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50;
    const cursor = searchParams.get("cursor") ?? undefined;

    const items = await prisma.arrendatario.findMany({
      where: { proyectoId },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" }
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
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
    const created = await prisma.arrendatario.create({
      data: {
        proyectoId: payload.proyectoId,
        rut: normalizeRut(payload.rut),
        razonSocial: payload.razonSocial,
        nombreComercial: payload.nombreComercial,
        vigente: payload.vigente,
        email: payload.email || null,
        telefono: payload.telefono || null
      }
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
