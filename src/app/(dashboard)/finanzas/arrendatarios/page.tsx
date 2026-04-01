import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { ArrendatariosFinanzasClient } from "@/components/finanzas/ArrendatariosFinanzasClient";

export default async function ArrendatariosFinanzasPage({
  searchParams
}: {
  searchParams: { proyecto?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  return (
    <ArrendatariosFinanzasClient
      projects={projects}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.desde}
      defaultHasta={searchParams.hasta}
    />
  );
}
