export const dynamic = "force-dynamic";

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { handleApiError } from "@/lib/api-error";
import { SLUG_MAX_ATTEMPTS } from "@/lib/constants";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PROJECTS_TAG } from "@/lib/project";
import { setSelectedProjectCookie } from "@/lib/project-cookie";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

const projectSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color invalido. Usa formato hexadecimal #RRGGBB.")
    .optional(),
  activo: z.boolean().optional(),
  glaTotal: z
    .string()
    .trim()
    .refine((v) => v === "" || !isNaN(Number(v)), "GLA invalido.")
    .optional()
    .nullable()
});

async function buildUniqueSlug(baseSlug: string): Promise<string> {
  let candidate = baseSlug;
  for (let attempt = 1; attempt <= SLUG_MAX_ATTEMPTS; attempt += 1) {
    const exists = await prisma.project.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!exists) {
      return candidate;
    }
    candidate = `${baseSlug}-${attempt + 1}`;
  }
  throw new Error(
    `No se pudo generar un slug unico para "${baseSlug}" tras ${SLUG_MAX_ATTEMPTS} intentos.`
  );
}

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();
    const projects = await prisma.project.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, slug: true, color: true, activo: true, glaTotal: true }
    });
    const serialized = projects.map((p) => ({ ...p, glaTotal: p.glaTotal?.toString() ?? null }));
    return NextResponse.json(serialized);
  } catch (error) {
    return handleApiError(error);
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

    const glaTotalRaw = result.data.glaTotal;
    const created = await prisma.project.create({
      data: {
        nombre: result.data.nombre,
        color: result.data.color ?? "#0f766e",
        slug,
        activo: result.data.activo ?? true,
        glaTotal: glaTotalRaw && glaTotalRaw !== "" ? new Prisma.Decimal(glaTotalRaw) : null
      },
      select: { id: true, nombre: true, slug: true, color: true, activo: true, glaTotal: true }
    });

    const serialized = { ...created, glaTotal: created.glaTotal?.toString() ?? null };

    revalidateTag(ACTIVE_PROJECTS_TAG);
    setSelectedProjectCookie(created.id);
    return NextResponse.json(serialized, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
