import path from "node:path";
import { MAX_PDF_BYTES } from "@/lib/constants";

export const MAX_CONTRACT_PDF_SIZE_BYTES = MAX_PDF_BYTES;

/**
 * Validates whether an uploaded contract file is an acceptable PDF.
 * @param file - File selected by the user
 * @returns Validation error message or `null` when valid
 */
export function validateContractPdf(file: File | null): string | null {
  if (!file) {
    return "Debes adjuntar un archivo PDF.";
  }

  if (file.type !== "application/pdf") {
    return "El archivo debe ser un PDF valido (application/pdf).";
  }

  if (file.size > MAX_PDF_BYTES) {
    return "El archivo supera el maximo permitido de 10MB.";
  }

  return null;
}

/**
 * Resolves filesystem and public URL paths for a contract PDF.
 * @param contractId - Contract identifier used as PDF filename
 * @returns Absolute directory/path and public URL for storage
 */
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
