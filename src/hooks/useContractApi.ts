import type { ContractFormPayload } from "@/types";
import type { ContractWriteApiResponse } from "@/types/contracts";
import { extractApiErrorMessage } from "@/lib/http/client-errors";

export type ContractDraft = ContractFormPayload;

export type ContractRow = ContractWriteApiResponse;

export function useContractApi(): {
  saveContract: (draft: ContractDraft, existingId?: string) => Promise<ContractRow>;
  deleteContract: (id: string, proyectoId: string) => Promise<void>;
  uploadContractPdf: (id: string, file: File) => Promise<string>;
} {
  async function saveContract(draft: ContractDraft, existingId?: string): Promise<ContractRow> {
    const isEditing = Boolean(existingId);
    const editQuery = `?projectId=${encodeURIComponent(draft.proyectoId)}`;
    const response = await fetch(
      isEditing ? `/api/contracts/${existingId}${editQuery}` : "/api/contracts",
      {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
      }
    );

    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "No se pudo guardar el contrato."));
    }

    return (await response.json()) as ContractRow;
  }

  async function deleteContract(id: string, proyectoId: string): Promise<void> {
    const response = await fetch(`/api/contracts/${id}?projectId=${encodeURIComponent(proyectoId)}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(await extractApiErrorMessage(response, "No se pudo eliminar el contrato."));
    }
  }

  async function uploadContractPdf(id: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.set("pdf", file);

    const response = await fetch(`/api/contracts/${id}/pdf`, {
      method: "POST",
      body: formData
    });
    const data = (await response.json()) as { pdfUrl?: string; message?: string };
    if (!response.ok || !data.pdfUrl) {
      throw new Error(data.message ?? "No se pudo subir el PDF.");
    }

    return data.pdfUrl;
  }

  return {
    saveContract,
    deleteContract,
    uploadContractPdf
  };
}
