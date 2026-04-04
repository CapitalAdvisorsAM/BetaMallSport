import { prisma } from "@/lib/prisma";

export const contractInclude = {
  local: true,
  locales: {
    include: {
      local: true
    },
    orderBy: { createdAt: "asc" as const }
  },
  arrendatario: true,
  tarifas: { orderBy: { vigenciaDesde: "desc" as const } },
  ggcc: { orderBy: { vigenciaDesde: "desc" as const } },
  anexos: { orderBy: { createdAt: "desc" as const }, take: 5 }
} as const;

export async function listContractsPage(input: {
  proyectoId: string;
  limit: number;
  cursor?: string;
}) {
  const items = await prisma.contrato.findMany({
    where: { proyectoId: input.proyectoId },
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
