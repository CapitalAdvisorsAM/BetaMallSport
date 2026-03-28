import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
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

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");

    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const arrendatarios = await prisma.arrendatario.findMany({
      where: { proyectoId },
      orderBy: { nombreComercial: "asc" }
    });
    return NextResponse.json(arrendatarios);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible listar arrendatarios." }, { status: 500 });
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
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "Ya existe un arrendatario con ese RUT para el proyecto seleccionado." },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "No fue posible crear el arrendatario." }, { status: 500 });
  }
}
