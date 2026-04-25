import { MasterStatus, type Prisma } from "@prisma/client";

export type UnitsFilters = {
  q: string;
  estado?: MasterStatus;
};

const allowedEstados = new Set<MasterStatus>(["ACTIVO", "INACTIVO"]);

/**
 * Parses the unit state filter from query params.
 * @param estado - Raw estado value from query params
 * @returns A valid `MasterStatus` value or `undefined`
 */
export function parseUnitsStatus(estado?: string): MasterStatus | undefined {
  if (!estado) {
    return undefined;
  }
  return allowedEstados.has(estado as MasterStatus) ? (estado as MasterStatus) : undefined;
}

/**
 * Builds the Prisma `where` clause for units listing.
 * @param proyectoId - Project identifier used to scope the query
 * @param filters - Search and estado filters
 * @returns Prisma where input for units
 */
export function buildUnitsWhere(
  proyectoId: string,
  filters: UnitsFilters
): Prisma.UnitWhereInput {
  const q = filters.q.trim();

  return {
    projectId: proyectoId,
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
