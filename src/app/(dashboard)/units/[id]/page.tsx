import { redirect } from "next/navigation";
import { Local360Client } from "@/components/local-360/Local360Client";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    from?: string;
    to?: string;
    desde?: string;
    hasta?: string;
  };
}): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  return (
    <Local360Client
      unitId={params.id}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
