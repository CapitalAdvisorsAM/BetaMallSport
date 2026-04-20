import { redirect } from "next/navigation";
import { DataUploadType } from "@prisma/client";
import { FinanceUploadClient } from "@/components/finance/FinanceUploadClient";
import { requireSession } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { getUploadHistory } from "@/lib/upload/history";

export default async function FinanceUploadPage(): Promise<JSX.Element> {
  await requireSession();
  const { selectedProjectId } = await getProjectContext();

  if (!selectedProjectId) {
    redirect("/");
  }

  const [accountingHistory, salesHistory, budgetedSalesHistory, expenseBudgetHistory, balancesHistory, bankHistory] =
    await Promise.all([
      getUploadHistory(selectedProjectId, DataUploadType.ACCOUNTING, "created"),
      getUploadHistory(selectedProjectId, DataUploadType.SALES, "updated"),
      getUploadHistory(selectedProjectId, DataUploadType.BUDGETED_SALES, "updated"),
      getUploadHistory(selectedProjectId, DataUploadType.EXPENSE_BUDGET, "created"),
      getUploadHistory(selectedProjectId, DataUploadType.BALANCES, "created"),
      getUploadHistory(selectedProjectId, DataUploadType.BANK, "created")
    ]);

  return (
    <FinanceUploadClient
      selectedProjectId={selectedProjectId}
      accountingHistory={accountingHistory}
      salesHistory={salesHistory}
      budgetedSalesHistory={budgetedSalesHistory}
      expenseBudgetHistory={expenseBudgetHistory}
      balancesHistory={balancesHistory}
      bankHistory={bankHistory}
    />
  );
}
