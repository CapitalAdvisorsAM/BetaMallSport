import { TipoCargaDatos } from "@prisma/client";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { FinanzasUploadClient } from "@/components/finanzas/FinanzasUploadClient";
import { getUploadHistory } from "@/lib/upload/history";

export default async function FinanzasUploadPage({
  searchParams
}: {
  searchParams: { proyecto?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para cargar datos contables y ventas."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  const [historialContable, historialVentas] = await Promise.all([
    getUploadHistory(selectedProjectId, TipoCargaDatos.CONTABLE, "created"),
    getUploadHistory(selectedProjectId, TipoCargaDatos.VENTAS, "updated")
  ]);

  return (
    <FinanzasUploadClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      historialContable={historialContable}
      historialVentas={historialVentas}
    />
  );
}
