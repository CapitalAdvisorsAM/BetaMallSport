import type { Prisma } from "@prisma/client";

export type ArrendatariosFilters = {
  q: string;
  vigente?: boolean;
};

export type ArrendatariosContractPeriod = {
  start: Date;
  nextMonthStart: Date;
};

/**
 * Builds the Prisma `where` clause for contracts considered active in arrendatarios listing.
 * @param period - Current month bounds for contratoDia filtering
 * @returns Prisma where input for contratos
 */
export function buildArrendatariosActiveContractWhere(
  period: ArrendatariosContractPeriod
): Prisma.ContractWhereInput {
  return {
    OR: [
      // Primary: pre-computed daily records confirm active status
      {
        contratosDia: {
          some: {
            fecha: { gte: period.start, lt: period.nextMonthStart },
            estadoDia: { in: ["OCUPADO", "GRACIA"] }
          }
        }
      },
      // Fallback: contract date range overlaps current month and estado is active
      {
        fechaInicio: { lt: period.nextMonthStart },
        fechaTermino: { gte: period.start },
        estado: { in: ["VIGENTE", "GRACIA"] }
      }
    ]
  };
}

/**
 * Parses the vigente filter query param into a boolean value.
 * @param value - Raw filter value from query params
 * @returns `true`, `false`, or `undefined` when no filter applies
 */
export function parseVigenteFilter(value?: string): boolean | undefined {
  if (value === "vigente") {
    return true;
  }
  if (value === "no-vigente") {
    return false;
  }
  return undefined;
}

/**
 * Builds the Prisma `where` clause for arrendatarios with active contracts in period.
 * @param proyectoId - Project identifier used to scope the query
 * @param period - Current month bounds for contratoDia filtering
 * @param filters - Search and vigente filters at arrendatario level
 * @returns Prisma where input for arrendatarios
 */
export function buildArrendatariosWhere(
  proyectoId: string,
  period: ArrendatariosContractPeriod,
  filters: ArrendatariosFilters
): Prisma.TenantWhereInput {
  const q = filters.q.trim();
  const activeContractWhere = buildArrendatariosActiveContractWhere(period);

  return {
    proyectoId,
    contratos: {
      some: activeContractWhere
    },
    ...(typeof filters.vigente === "boolean" ? { vigente: filters.vigente } : {}),
    ...(q
      ? {
          OR: [
            { nombreComercial: { contains: q, mode: "insensitive" } },
            { rut: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };
}

