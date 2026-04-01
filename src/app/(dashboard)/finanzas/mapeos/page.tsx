import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { MapeosClient } from "@/components/finanzas/MapeosClient";
import { prisma } from "@/lib/prisma";

export default async function MapeosPage({
  searchParams
}: {
  searchParams: { proyecto?: string; tab?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  const [mapeosContable, mapeosVentas, locales] = selectedProjectId
    ? await Promise.all([
        prisma.mapeoLocalContable.findMany({
          where: { proyectoId: selectedProjectId },
          include: { local: { select: { codigo: true, nombre: true } } },
          orderBy: { localExterno: "asc" }
        }),
        prisma.mapeoVentasLocal.findMany({
          where: { proyectoId: selectedProjectId },
          include: { local: { select: { codigo: true, nombre: true } } },
          orderBy: { tiendaNombre: "asc" }
        }),
        prisma.local.findMany({
          where: { proyectoId: selectedProjectId, estado: "ACTIVO" },
          select: { id: true, codigo: true, nombre: true },
          orderBy: { codigo: "asc" }
        })
      ])
    : [[], [], []];

  return (
    <MapeosClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      mapeosContable={mapeosContable}
      mapeosVentas={mapeosVentas}
      locales={locales}
      defaultTab={(searchParams.tab ?? "contable") as "contable" | "ventas"}
    />
  );
}
