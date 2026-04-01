import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { FinanzasUploadClient } from "@/components/finanzas/FinanzasUploadClient";
import { prisma } from "@/lib/prisma";

export default async function FinanzasUploadPage({
  searchParams
}: {
  searchParams: { proyecto?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  const [historialContable, historialVentas] = selectedProjectId
    ? await Promise.all([
        prisma.cargaDatos.findMany({
          where: { proyectoId: selectedProjectId, tipo: "CONTABLE" },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, archivoNombre: true, registrosCargados: true, estado: true, createdAt: true }
        }),
        prisma.cargaDatos.findMany({
          where: { proyectoId: selectedProjectId, tipo: "VENTAS" },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, archivoNombre: true, registrosCargados: true, estado: true, createdAt: true }
        })
      ])
    : [[], []];

  return (
    <FinanzasUploadClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      historialContable={historialContable}
      historialVentas={historialVentas}
    />
  );
}
