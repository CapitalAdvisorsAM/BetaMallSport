import { extractApiErrorMessage } from "@/lib/http/client-errors";
import type {
  BudgetedSaleCellPayload,
  BudgetedSaleCellResponse,
} from "@/types/rent-roll";

export function useBudgetedSalesCellApi(): {
  saveCell: (payload: BudgetedSaleCellPayload) => Promise<BudgetedSaleCellResponse>;
} {
  async function saveCell(
    payload: BudgetedSaleCellPayload,
  ): Promise<BudgetedSaleCellResponse> {
    const response = await fetch(
      `/api/plan/budgeted-sales?projectId=${encodeURIComponent(payload.projectId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(
        await extractApiErrorMessage(response, "No se pudo guardar el valor."),
      );
    }

    return (await response.json()) as BudgetedSaleCellResponse;
  }

  return { saveCell };
}
