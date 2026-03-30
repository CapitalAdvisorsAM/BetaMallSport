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
 * Builds the Prisma `where` clause for active contracts in arrendatarios listing.
 * @param proyectoId - Project identifier used to scope the query
 * @param period - Current month bounds for contratoDia filtering
 * @param filters - Search and vigente filters at arrendatario level
 * @returns Prisma where input for contratos
 */
export function buildArrendatariosContractsWhere(
  proyectoId: string,
  period: ArrendatariosContractPeriod,
  filters: ArrendatariosFilters
): Prisma.ContratoWhereInput {
  const q = filters.q.trim();
  const arrendatarioFilters: Prisma.ArrendatarioWhereInput = {
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
  const hasArrendatarioFilters = Object.keys(arrendatarioFilters).length > 0;

  return {
    proyectoId,
    contratosDia: {
      some: {
        fecha: { gte: period.start, lt: period.nextMonthStart },
        estadoDia: { in: ["OCUPADO", "GRACIA"] }
      }
    },
    ...(hasArrendatarioFilters
      ? {
          arrendatario: arrendatarioFilters
        }
      : {})
  };
}

