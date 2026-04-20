import { redirect } from "next/navigation";
import { FacturacionClient } from "@/components/finance/FacturacionClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function FinanceFacturacionPage({
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
    <FacturacionClient
      selectedProjectId={selectedProjectId}
      defaultDesde={searchParams.from ?? searchParams.desde}
      defaultHasta={searchParams.to ?? searchParams.hasta}
    />
  );
}
