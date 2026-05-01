import { redirect } from "next/navigation";
import { ChartOfAccountsClient } from "@/components/settings/ChartOfAccountsClient";
import { requireSession, canWrite } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { prisma } from "@/lib/prisma";

export default async function ChartOfAccountsPage(): Promise<JSX.Element> {
  const session = await requireSession();
  const canEdit = canWrite(session.user.role);
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  const accounts = await prisma.chartOfAccount.findMany({
    where: { projectId: selectedProjectId },
    orderBy: [{ displayOrder: "asc" }, { group1: "asc" }, { group3: "asc" }]
  });

  const serialized = accounts.map((account) => ({
    id: account.id,
    group0: account.group0,
    group1: account.group1,
    group2: account.group2,
    group3: account.group3,
    type: account.type,
    alias: account.alias,
    displayOrder: account.displayOrder,
    notes: account.notes
  }));

  return <ChartOfAccountsClient accounts={serialized} canEdit={canEdit} />;
}
