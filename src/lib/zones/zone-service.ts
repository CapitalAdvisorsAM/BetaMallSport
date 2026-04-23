import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { zoneSchema } from "@/lib/zones/schema";

type ZonePayload = z.infer<typeof zoneSchema>;

export async function listZonesByProject(projectId: string) {
  return prisma.zone.findMany({
    where: { projectId: projectId },
    orderBy: { nombre: "asc" },
    select: { id: true, projectId: true, nombre: true, createdAt: true }
  });
}

export async function createZone(payload: ZonePayload) {
  try {
    return await prisma.zone.create({
      data: {
        projectId: payload.projectId,
        nombre: payload.nombre
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "Ya existe una zona con ese nombre en este proyecto.");
    }
    throw error;
  }
}

export async function updateZone(input: { zoneId: string; projectId: string; nombre: string }) {
  const existing = await prisma.zone.findFirst({
    where: { id: input.zoneId, projectId: input.projectId },
    select: { id: true }
  });
  if (!existing) {
    throw new ApiError(404, "Zona no encontrada.");
  }

  try {
    return await prisma.zone.update({
      where: { id: input.zoneId },
      data: { nombre: input.nombre }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "Ya existe una zona con ese nombre en este proyecto.");
    }
    throw error;
  }
}

export async function deleteZone(input: { zoneId: string; projectId: string }) {
  const deleted = await prisma.zone.deleteMany({
    where: { id: input.zoneId, projectId: input.projectId }
  });

  if (deleted.count === 0) {
    throw new ApiError(404, "Zona no encontrada.");
  }
}
