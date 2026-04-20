import { redirect } from "next/navigation";
import { EeffClient } from "@/components/finance/EeffClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function FinanceEeffPage({
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
    <EeffClient
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
