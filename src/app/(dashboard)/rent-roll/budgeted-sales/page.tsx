import { redirect } from "next/navigation";
import { BudgetedSalesMatrixClient } from "@/components/rent-roll/BudgetedSalesMatrixClient";
import { canWrite, requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { fetchBudgetedSalesMatrix } from "@/lib/rent-roll/budgeted-sales-matrix";
import { isPeriodoValido } from "@/lib/validators";

type PageProps = {
  searchParams: {
    proyecto?: string;
    desde?: string;
    hasta?: string;
  };
};

function defaultRangeForCurrentYear(): { desde: string; hasta: string } {
  const year = new Date().getUTCFullYear();
  return { desde: `${year}-01`, hasta: `${year}-12` };
}

export default async function BudgetedSalesByTenantPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const session = await requireSession();
  const canEdit = canWrite(session.user.role);

  const { selectedProjectId } = await getProjectContext();
  if (!selectedProjectId) {
    redirect("/");
  }

  const fallback = defaultRangeForCurrentYear();
  const desde = isPeriodoValido(searchParams.desde ?? "")
    ? (searchParams.desde as string)
    : fallback.desde;
  const hasta = isPeriodoValido(searchParams.hasta ?? "")
    ? (searchParams.hasta as string)
    : fallback.hasta;

  const [minDesde, maxHasta] = desde <= hasta ? [desde, hasta] : [hasta, desde];

  const data = await fetchBudgetedSalesMatrix(selectedProjectId, minDesde, maxHasta);

  return (
    <BudgetedSalesMatrixClient
      selectedProjectId={selectedProjectId}
      desde={minDesde}
      hasta={maxHasta}
      data={data}
      canEdit={canEdit}
    />
  );
}
