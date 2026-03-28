import type { ContractFormPayload } from "@/types";

export type ContractDraft = ContractFormPayload;

export type ContractRow = {
  id: string;
  [key: string]: unknown;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return fallback;
  }

  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function useContractApi(): {
  saveContract: (draft: ContractDraft, existingId?: string) => Promise<ContractRow>;
  deleteContract: (id: string) => Promise<void>;
  uploadContractPdf: (id: string, file: File) => Promise<string>;
} {
  async function saveContract(draft: ContractDraft, existingId?: string): Promise<ContractRow> {
    const isEditing = Boolean(existingId);
    const response = await fetch(isEditing ? `/api/contracts/${existingId}` : "/api/contracts", {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "No se pudo guardar el contrato."));
    }

    return (await response.json()) as ContractRow;
  }

  async function deleteContract(id: string): Promise<void> {
    const response = await fetch(`/api/contracts/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "No se pudo eliminar el contrato."));
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
