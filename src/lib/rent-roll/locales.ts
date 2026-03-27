import { EstadoMaestro, type Prisma } from "@prisma/client";

export type LocalesFilters = {
  q: string;
  estado?: EstadoMaestro;
};

const allowedEstados = new Set<EstadoMaestro>(["ACTIVO", "INACTIVO"]);

export function parseLocalesEstado(estado?: string): EstadoMaestro | undefined {
  if (!estado) {
    return undefined;
  }
  return allowedEstados.has(estado as EstadoMaestro) ? (estado as EstadoMaestro) : undefined;
}

export function buildLocalesWhere(
  proyectoId: string,
  filters: LocalesFilters
): Prisma.LocalWhereInput {
  const q = filters.q.trim();

  return {
    proyectoId,
    ...(filters.estado ? { estado: filters.estado } : {}),
    ...(q
      ? {
          OR: [
            { codigo: { contains: q, mode: "insensitive" } },
            { nombre: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };
}
