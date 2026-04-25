import { prisma } from "@/lib/prisma";
import { computeEstadoContrato, startOfDay } from "@/lib/utils";

export const contractInclude = {
  local: true,
  locales: {
    include: {
      local: true
    },
    orderBy: { createdAt: "asc" as const }
  },
  arrendatario: true,
  tarifas: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "desc" as const } },
  ggcc: { where: { supersededAt: null }, orderBy: { vigenciaDesde: "desc" as const } },
  anexos: { orderBy: { createdAt: "desc" as const }, take: 5 }
} as const;

type ContractWithDates = {
  fechaInicio: Date;
  fechaTermino: Date;
  diasGracia: number;
  estado: Parameters<typeof computeEstadoContrato>[3];
};

export function applyEstadoComputado<T extends ContractWithDates>(
  contracts: T[],
  today: Date = startOfDay(new Date())
): T[] {
  return contracts.map((contract) => ({
    ...contract,
    estado: computeEstadoContrato(
      contract.fechaInicio,
      contract.fechaTermino,
      contract.diasGracia,
      contract.estado,
      today
    )
  }));
}

export async function listContractsPage(input: {
  projectId: string;
  limit: number;
  cursor?: string;
}) {
  const items = await prisma.contract.findMany({
    where: { projectId: input.projectId },
    include: contractInclude,
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: { id: "asc" }
  });

  const hasMore = items.length > input.limit;
  const data = hasMore ? items.slice(0, input.limit) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return { data, nextCursor, hasMore };
}
