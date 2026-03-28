import type { Prisma } from "@prisma/client";
import { formatUf } from "@/lib/kpi";

export type ArrendatariosFilters = {
  q: string;
  vigente?: boolean;
};

export type ContractMetricsInput = {
  local: { codigo: string; nombre: string } | null;
  tarifas: Array<{ valor: { toString(): string } }>;
  ggcc: Array<{
    tarifaBaseUfM2: { toString(): string };
    pctAdministracion: { toString(): string };
  }>;
};

function formatRentRollUf(value: { toString(): string } | null | undefined): string {
  const normalized = formatUf(value);
  if (normalized === "\u2014") {
    return normalized;
  }
  return Number(normalized).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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
 * Builds the Prisma `where` clause for arrendatarios listing.
 * @param proyectoId - Project identifier used to scope the query
 * @param filters - Search and vigente filters
 * @returns Prisma where input for arrendatarios
 */
export function buildArrendatariosWhere(
  proyectoId: string,
  filters: ArrendatariosFilters
): Prisma.ArrendatarioWhereInput {
  const q = filters.q.trim();

  return {
    proyectoId,
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

/**
 * Maps contract data into display-ready metrics for rent-roll tables.
 * @param contract - Contract with locale, tariff, and GGCC details
 * @returns Contract metrics formatted for UI rendering
 */
export function toContractMetrics(contract: ContractMetricsInput | null): {
  localActual: string;
  tarifaVigenteUfM2: string;
  ggccTarifaBaseUfM2: string;
  ggccPctAdministracion: string;
} {
  if (!contract) {
    return {
      localActual: "\u2014",
      tarifaVigenteUfM2: "\u2014",
      ggccTarifaBaseUfM2: "\u2014",
      ggccPctAdministracion: "\u2014"
    };
  }

  const ggccRecord = contract.ggcc[0];
  return {
    localActual: contract.local ? `${contract.local.codigo} - ${contract.local.nombre}` : "\u2014",
    tarifaVigenteUfM2: formatRentRollUf(contract.tarifas[0]?.valor),
    ggccTarifaBaseUfM2: formatRentRollUf(ggccRecord?.tarifaBaseUfM2),
    ggccPctAdministracion: formatRentRollUf(ggccRecord?.pctAdministracion)
  };
}

