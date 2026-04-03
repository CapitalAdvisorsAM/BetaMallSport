import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { MapeosClient } from "@/components/finanzas/MapeosClient";
import { getFinanzasMapeosData } from "@/lib/finanzas/mapeos";

export default async function MapeosPage({
  searchParams
}: {
  searchParams: { proyecto?: string; tab?: string };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Finanzas"
        description="No hay proyectos activos. Crea uno para administrar mapeos entre finanzas y rent roll."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  const { mapeosContable, mapeosVentas, locales } = await getFinanzasMapeosData(selectedProjectId);

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
