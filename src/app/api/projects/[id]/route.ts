export const dynamic = "force-dynamic";

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import { PERIODO_REGEX, SLUG_MAX_ATTEMPTS } from "@/lib/constants";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PROJECTS_TAG } from "@/lib/project";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

const projectUpdateSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color invalido. Usa formato hexadecimal #RRGGBB."),
  activo: z.boolean(),
  glaTotal: z
    .string()
    .trim()
    .refine((v) => v === "" || !isNaN(Number(v)), "GLA invalido.")
    .optional()
    .nullable()
});

const reportDatePatchSchema = z.object({
  reportDate: z
    .string()
    .regex(PERIODO_REGEX, "Formato debe ser YYYY-MM.")
    .nullable()
});

function periodoToDate(periodo: string): Date {
  const [year, month] = periodo.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, 1));
}

function dateToPeriodo(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function buildUniqueSlug(baseSlug: string, excludeId: string): Promise<string> {
  let candidate = baseSlug;
  for (let attempt = 1; attempt <= SLUG_MAX_ATTEMPTS; attempt += 1) {
    const exists = await prisma.project.findFirst({
      where: { slug: candidate, id: { not: excludeId } },
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

export async function GET(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const item = await prisma.project.findUnique({
      where: { id: context.params.id },
      select: { id: true, nombre: true, slug: true, color: true, activo: true, glaTotal: true, reportDate: true }
    });
    if (!item) {
      throw new ApiError(404, "No encontrado.");
    }
    return NextResponse.json({
      ...item,
      glaTotal: item.glaTotal?.toString() ?? null,
      reportDate: dateToPeriodo(item.reportDate)
    });
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

    const existing = await prisma.project.findUnique({
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

    const glaTotalRaw = payload.glaTotal;
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        nombre: payload.nombre,
        color: payload.color,
        activo: payload.activo,
        glaTotal: glaTotalRaw && glaTotalRaw !== "" ? new Prisma.Decimal(glaTotalRaw) : null,
        ...(slug ? { slug } : {})
      },
      select: { id: true, nombre: true, slug: true, color: true, activo: true, glaTotal: true }
    });

    revalidateTag(ACTIVE_PROJECTS_TAG);
    return NextResponse.json({ ...updated, glaTotal: updated.glaTotal?.toString() ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const projectId = context.params.id;

    const existing = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Proyecto no encontrado." }, { status: 404 });
    }

    const result = reportDatePatchSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0]?.message ?? "Payload invalido.", issues: result.error.issues },
        { status: 400 }
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { reportDate: result.data.reportDate ? periodoToDate(result.data.reportDate) : null },
      select: { id: true, reportDate: true }
    });

    revalidateTag(ACTIVE_PROJECTS_TAG);
    return NextResponse.json({ id: updated.id, reportDate: dateToPeriodo(updated.reportDate) });
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

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        _count: {
          select: {
            locales: true,
            arrendatarios: true,
            contratos: true,
            contratosDia: true,
            dataUploads: true
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
      project._count.dataUploads;

    if (relatedRows > 0) {
      return NextResponse.json(
        {
          message:
            "No se puede eliminar el proyecto porque tiene datos asociados. Desactivalo en lugar de eliminarlo."
        },
        { status: 409 }
      );
    }

    await prisma.project.delete({
      where: { id: projectId }
    });

    revalidateTag(ACTIVE_PROJECTS_TAG);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
