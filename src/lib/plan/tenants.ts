import type { Prisma } from "@prisma/client";

export type TenantsFilters = {
  q: string;
  vigente?: boolean;
};

export type TenantsContractPeriod = {
  start: Date;
  nextMonthStart: Date;
};

/**
 * Builds the Prisma `where` clause for contracts considered active in tenants listing.
 * @param period - Current month bounds for contratoDia filtering
 * @returns Prisma where input for contratos
 */
export function buildTenantsActiveContractWhere(
  period: TenantsContractPeriod
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
 * Parses the active filter query param into a boolean value.
 * @param value - Raw filter value from query params
 * @returns `true`, `false`, or `undefined` when no filter applies
 */
export function parseTenantActiveFilter(value?: string): boolean | undefined {
  if (value === "vigente") {
    return true;
  }
  if (value === "no-vigente") {
    return false;
  }
  return undefined;
}

/**
 * Builds the Prisma `where` clause for tenants with active contracts in period.
 * @param proyectoId - Project identifier used to scope the query
 * @param period - Current month bounds for contratoDia filtering
 * @param filters - Search and active filters at tenant level
 * @returns Prisma where input for tenants
 */
export function buildTenantsWhere(
  proyectoId: string,
  period: TenantsContractPeriod,
  filters: TenantsFilters
): Prisma.TenantWhereInput {
  const q = filters.q.trim();
  const activeContractWhere = buildTenantsActiveContractWhere(period);

  return {
    projectId: proyectoId,
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
