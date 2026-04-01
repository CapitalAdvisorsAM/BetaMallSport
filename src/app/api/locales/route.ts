import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { localeSchema } from "@/lib/locales/schema";
import { parsePaginationParams } from "@/lib/pagination";
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
      const locales = await prisma.local.findMany({
        where: { proyectoId },
        orderBy: [{ codigo: "asc" }]
      });
      return NextResponse.json(locales);
    }

    const { limit, cursor } = parsePaginationParams(searchParams);

    const items = await prisma.local.findMany({
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
    const result = localeSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const payload = result.data;
    const duplicatedLocal = await prisma.local.findFirst({
      where: {
        proyectoId: payload.proyectoId,
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

    const created = await prisma.local.create({
      data: {
        proyectoId: payload.proyectoId,
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

    return NextResponse.json(created, { status: 201 });
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
