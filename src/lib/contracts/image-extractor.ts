import Tesseract from "tesseract.js";
import type { ContractExtraction } from "@/lib/contracts/pdf-extractor";
import { extractContractFromText } from "@/lib/contracts/pdf-extractor";

export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp";

export async function extractContractFromImage(
  buffer: Buffer,
  mimeType: ImageMimeType
): Promise<ContractExtraction> {
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  const result = await Tesseract.recognize(dataUrl, "spa", {
    logger: () => undefined
  });

  return extractContractFromText(result.data.text);
}
