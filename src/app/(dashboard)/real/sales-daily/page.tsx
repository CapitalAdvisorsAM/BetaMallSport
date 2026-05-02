import { redirect } from "next/navigation";
import { VentasDiariasClient } from "@/components/real/VentasDiariasClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";

export default async function FinanceVentasDiariasPage({
  searchParams
}: {
  searchParams: { period?: string };
}): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  return (
    <VentasDiariasClient
      selectedProjectId={selectedProjectId}
      defaultPeriod={searchParams.period}
    />
  );
}
