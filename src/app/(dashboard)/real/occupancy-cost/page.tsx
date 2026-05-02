import { redirect } from "next/navigation";
import { CostoOcupacionClient } from "@/components/reconciliation/CostoOcupacionClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function FinanceOccupancyCostPage({
  searchParams
}: {
  searchParams: { to?: string; hasta?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  return (
    <CostoOcupacionClient
      selectedProjectId={selectedProjectId}
      defaultPeriod={searchParams.to ?? searchParams.hasta}
    />
  );
}
