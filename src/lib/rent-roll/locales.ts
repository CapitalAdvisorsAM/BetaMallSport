import { EstadoMaestro, type Prisma } from "@prisma/client";

export type LocalesFilters = {
  q: string;
  estado?: EstadoMaestro;
};

const allowedEstados = new Set<EstadoMaestro>(["ACTIVO", "INACTIVO"]);

/**
 * Parses the locale state filter from query params.
 * @param estado - Raw estado value from query params
 * @returns A valid `EstadoMaestro` value or `undefined`
 */
export function parseLocalesEstado(estado?: string): EstadoMaestro | undefined {
  if (!estado) {
    return undefined;
  }
  return allowedEstados.has(estado as EstadoMaestro) ? (estado as EstadoMaestro) : undefined;
}

/**
 * Builds the Prisma `where` clause for locales listing.
 * @param proyectoId - Project identifier used to scope the query
 * @param filters - Search and estado filters
 * @returns Prisma where input for locales
 */
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
