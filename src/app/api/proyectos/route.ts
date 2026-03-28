import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const projectSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color invalido. Usa formato hexadecimal #RRGGBB.")
    .optional(),
  activo: z.boolean().optional()
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

async function buildUniqueSlug(baseSlug: string): Promise<string> {
  const MAX_SLUG_ATTEMPTS = 50;
  let candidate = baseSlug;
  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
    const exists = await prisma.proyecto.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!exists) {
      return candidate;
    }
    candidate = `${baseSlug}-${attempt + 1}`;
  }
  throw new Error(
    `No se pudo generar un slug único para "${baseSlug}" tras ${MAX_SLUG_ATTEMPTS} intentos.`
  );
}

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();
    const projects = await prisma.proyecto.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, slug: true, color: true, activo: true }
    });
    return NextResponse.json(projects);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible listar proyectos." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const result = projectSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const baseSlug = slugify(result.data.nombre);
    const slug = await buildUniqueSlug(baseSlug);

    const created = await prisma.proyecto.create({
      data: {
        nombre: result.data.nombre,
        color: result.data.color ?? "#0f766e",
        slug,
        activo: result.data.activo ?? true
      },
      select: { id: true, nombre: true, slug: true, color: true, activo: true }
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "Ya existe un proyecto con ese identificador." }, { status: 409 });
    }
    return NextResponse.json({ message: "No fue posible crear el proyecto." }, { status: 500 });
  }
}
