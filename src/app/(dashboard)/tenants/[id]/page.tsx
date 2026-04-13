import { Tenant360Client } from "@/components/tenant-360/Tenant360Client";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";

export default async function TenantDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: {
    project?: string;
    from?: string;
    to?: string;
    desde?: string;
    hasta?: string;
  };
}): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);
  const { projects, selectedProjectId } = await getProjectContext(projectParam);

  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Detalle Arrendatario"
        description="No hay proyectos activos."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  return (
    <Tenant360Client
      tenantId={params.id}
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
