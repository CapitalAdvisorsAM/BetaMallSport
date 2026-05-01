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

  const {
    accountingMappings,
    salesMappings,
    accountingTenantMappings,
    unmappedAccountingRecords,
    units,
    tenants
  } =
    await getFinanceMappingsData(selectedProjectId);

  const tabParam = searchParams.tab;
  const defaultTab: "accounting" | "sales" | "accounting-tenants" | "unmapped-accounting" =
    tabParam === "sales" || tabParam === "ventas"
      ? "sales"
      : tabParam === "accounting-tenants" || tabParam === "arrendatarios"
        ? "accounting-tenants"
        : tabParam === "unmapped-accounting" || tabParam === "pendientes"
          ? "unmapped-accounting"
        : "accounting";

  return (
    <FinanceMappingsClient
      selectedProjectId={selectedProjectId}
      accountingMappings={accountingMappings}
      salesMappings={salesMappings}
      accountingTenantMappings={accountingTenantMappings}
      unmappedAccountingRecords={unmappedAccountingRecords}
      units={units}
      tenants={tenants}
      defaultTab={defaultTab}
    />
  );
}
