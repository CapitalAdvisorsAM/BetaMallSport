import { redirect } from "next/navigation";
import { GgccDeficitClient } from "@/components/real/GgccDeficitClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function FinanceGgccPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; desde?: string; hasta?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  return (
    <GgccDeficitClient
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
