import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { EERRClient } from "@/components/finanzas/EERRClient";

export default async function EERRPage({
  searchParams
}: {
  searchParams: { proyecto?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  return (
    <EERRClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.desde}
      defaultHasta={searchParams.hasta}
    />
  );
}
