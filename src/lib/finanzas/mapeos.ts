import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const contableMapeoSchema = z.object({
  proyectoId: z.string().uuid(),
  localExterno: z.string().min(1),
  localId: z.string().uuid()
});

export const ventasMapeoSchema = z.object({
  proyectoId: z.string().uuid(),
  idCa: z.number().int(),
  tiendaNombre: z.string().min(1),
  localId: z.string().uuid()
});

export async function getActiveLocales(proyectoId: string) {
  return prisma.local.findMany({
    where: { proyectoId, estado: "ACTIVO" },
    select: { id: true, codigo: true, nombre: true },
    orderBy: { codigo: "asc" }
  });
}

export async function getContableMapeos(proyectoId: string) {
  return prisma.mapeoLocalContable.findMany({
    where: { proyectoId },
    include: { local: { select: { codigo: true, nombre: true } } },
    orderBy: { localExterno: "asc" }
  });
}

export async function getVentasMapeos(proyectoId: string) {
  return prisma.mapeoVentasLocal.findMany({
    where: { proyectoId },
    include: { local: { select: { codigo: true, nombre: true } } },
    orderBy: { tiendaNombre: "asc" }
  });
}

export async function getFinanzasMapeosData(proyectoId: string) {
  const [mapeosContable, mapeosVentas, locales] = await Promise.all([
    getContableMapeos(proyectoId),
    getVentasMapeos(proyectoId),
    getActiveLocales(proyectoId)
  ]);

  return {
    mapeosContable,
    mapeosVentas,
    locales
  };
}

export async function upsertContableMapeo(
  data: z.infer<typeof contableMapeoSchema>,
  userId: string
) {
  return prisma.mapeoLocalContable.upsert({
    where: { proyectoId_localExterno: { proyectoId: data.proyectoId, localExterno: data.localExterno } },
    update: { localId: data.localId, creadoPor: userId },
    create: { ...data, creadoPor: userId }
  });
}

export async function upsertVentasMapeo(
  data: z.infer<typeof ventasMapeoSchema>,
  userId: string
) {
  return prisma.mapeoVentasLocal.upsert({
    where: { proyectoId_idCa: { proyectoId: data.proyectoId, idCa: data.idCa } },
    update: { localId: data.localId, tiendaNombre: data.tiendaNombre, creadoPor: userId },
    create: { ...data, creadoPor: userId }
  });
}
