import { redirect } from "next/navigation";
import { FinanceMappingsClient } from "@/components/real/FinanceMappingsClient";
import { getFinanceMappingsData } from "@/lib/real/mappings";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function FinanceMappingsPage({
  searchParams
}: {
  searchParams: { tab?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  const { accountingMappings, salesMappings, units } = await getFinanceMappingsData(selectedProjectId);
  const defaultTab = searchParams.tab === "sales" ? "sales" : searchParams.tab === "ventas" ? "sales" : "accounting";

  return (
    <FinanceMappingsClient
      selectedProjectId={selectedProjectId}
      accountingMappings={accountingMappings}
      salesMappings={salesMappings}
      units={units}
      defaultTab={defaultTab}
    />
  );
}
