import path from "node:path";

export const MAX_CONTRACT_PDF_SIZE_BYTES = 10 * 1024 * 1024;

export function validateContractPdf(file: File | null): string | null {
  if (!file) {
    return "Debes adjuntar un archivo PDF.";
  }

  if (file.type !== "application/pdf") {
    return "El archivo debe ser un PDF valido (application/pdf).";
  }

  if (file.size > MAX_CONTRACT_PDF_SIZE_BYTES) {
    return "El archivo supera el maximo permitido de 10MB.";
  }

  return null;
}

export function getContractPdfStorage(contractId: string): {
  absoluteDir: string;
  absoluteFilePath: string;
  publicUrl: string;
} {
  const absoluteDir = path.join(process.cwd(), "public", "uploads", "contratos");
  const filename = `${contractId}.pdf`;

  return {
    absoluteDir,
    absoluteFilePath: path.join(absoluteDir, filename),
    publicUrl: `/uploads/contratos/${filename}`
  };
}
