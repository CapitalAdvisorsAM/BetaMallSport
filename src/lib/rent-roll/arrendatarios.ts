import type { Prisma } from "@prisma/client";

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

export function parseVigenteFilter(value?: string): boolean | undefined {
  if (value === "vigente") {
    return true;
  }
  if (value === "no-vigente") {
    return false;
  }
  return undefined;
}

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

export function formatUf(value: { toString(): string } | null | undefined): string {
  if (!value) {
    return "\u2014";
  }
  return Number(value.toString()).toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

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
    tarifaVigenteUfM2: formatUf(contract.tarifas[0]?.valor),
    ggccTarifaBaseUfM2: formatUf(ggccRecord?.tarifaBaseUfM2),
    ggccPctAdministracion: formatUf(ggccRecord?.pctAdministracion)
  };
}

