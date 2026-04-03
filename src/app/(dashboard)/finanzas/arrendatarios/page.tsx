import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { ArrendatariosFinanzasClient } from "@/components/finanzas/ArrendatariosFinanzasClient";

export default async function ArrendatariosFinanzasPage({
  searchParams
}: {
  searchParams: { proyecto?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para analizar la facturacion por arrendatario."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <ArrendatariosFinanzasClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.desde}
      defaultHasta={searchParams.hasta}
    />
  );
}
