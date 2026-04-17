import { redirect } from "next/navigation";
import { Tenant360Client } from "@/components/tenant-360/Tenant360Client";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function TenantDetailPage({
  params,
  searchParams
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
    <Tenant360Client
      tenantId={params.id}
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
