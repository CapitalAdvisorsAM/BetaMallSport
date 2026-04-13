import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { buildCursorPaginatedResponse } from "@/lib/http/pagination-response";
import { prisma } from "@/lib/prisma";
import { unitSchema } from "@/lib/units/schema";

type UnitPayload = z.infer<typeof unitSchema>;

type ListUnitsPageInput = {
  projectId: string;
  limit: number;
  cursor?: string;
};

async function ensureUniqueCode(input: {
  projectId: string;
  code: string;
  excludeId?: string;
}): Promise<void> {
  const duplicate = await prisma.unit.findFirst({
    where: {
      proyectoId: input.projectId,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      codigo: {
        equals: input.code,
        mode: "insensitive"
      }
    },
    select: { id: true }
  });

  if (duplicate) {
    throw new ApiError(409, "Ya existe un local con ese codigo en este proyecto.");
  }
}

export async function listUnitsPage(input: ListUnitsPageInput) {
  const items = await prisma.unit.findMany({
    where: { proyectoId: input.projectId },
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: { id: "asc" }
  });

  return buildCursorPaginatedResponse(items, input.limit);
}

export async function getUnitById(input: { projectId: string; unitId: string }) {
  return prisma.unit.findFirst({
    where: { id: input.unitId, proyectoId: input.projectId }
  });
}

export async function createUnit(input: { payload: UnitPayload }) {
  await ensureUniqueCode({
    projectId: input.payload.proyectoId,
    code: input.payload.codigo
  });

  return prisma.unit.create({
    data: {
      proyectoId: input.payload.proyectoId,
      codigo: input.payload.codigo,
      nombre: input.payload.nombre,
      glam2: new Prisma.Decimal(input.payload.glam2),
      piso: input.payload.piso,
      tipo: input.payload.tipo,
      zonaId: input.payload.zonaId || null,
      esGLA: input.payload.esGLA,
      estado: input.payload.estado
    }
  });
}

export async function updateUnit(input: { unitId: string; payload: UnitPayload }) {
  const existing = await prisma.unit.findFirst({
    where: { id: input.unitId, proyectoId: input.payload.proyectoId },
    select: { id: true }
  });
  if (!existing) {
    throw new ApiError(404, "Local no encontrado.");
  }

  await ensureUniqueCode({
    projectId: input.payload.proyectoId,
    code: input.payload.codigo,
    excludeId: input.unitId
  });

  return prisma.unit.update({
    where: { id: input.unitId },
    data: {
      codigo: input.payload.codigo,
      nombre: input.payload.nombre,
      glam2: new Prisma.Decimal(input.payload.glam2),
      piso: input.payload.piso,
      tipo: input.payload.tipo,
      zonaId: input.payload.zonaId || null,
      esGLA: input.payload.esGLA,
      estado: input.payload.estado
    }
  });
}

export async function deleteUnit(input: { projectId: string; unitId: string }) {
  const deleted = await prisma.unit.deleteMany({
    where: { id: input.unitId, proyectoId: input.projectId }
  });

  if (deleted.count === 0) {
    throw new ApiError(404, "Local no encontrado.");
  }
}
