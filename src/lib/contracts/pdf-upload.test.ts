import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_CONTRACT_PDF_SIZE_BYTES,
  getContractPdfStorage,
  validateContractPdf
} from "@/lib/contracts/pdf-upload";

function createFakeFile(type: string, size: number): File {
  return { type, size } as File;
}

describe("validateContractPdf", () => {
  it("requires a file", () => {
    expect(validateContractPdf(null)).toContain("Debes adjuntar");
  });

  it("validates MIME type", () => {
    expect(validateContractPdf(createFakeFile("image/png", 1000))).toContain("application/pdf");
  });

  it("validates maximum size", () => {
    expect(validateContractPdf(createFakeFile("application/pdf", MAX_CONTRACT_PDF_SIZE_BYTES + 1))).toContain(
      "10MB"
    );
  });

  it("accepts valid pdf files", () => {
    expect(validateContractPdf(createFakeFile("application/pdf", MAX_CONTRACT_PDF_SIZE_BYTES))).toBeNull();
  });
});

describe("getContractPdfStorage", () => {
  it("returns expected absolute path and public URL", () => {
    const storage = getContractPdfStorage("ctr-1");
    expect(storage.absoluteDir).toBe(path.join(process.cwd(), "public", "uploads", "contratos"));
    expect(storage.absoluteFilePath).toBe(
      path.join(process.cwd(), "public", "uploads", "contratos", "ctr-1.pdf")
    );
    expect(storage.publicUrl).toBe("/uploads/contratos/ctr-1.pdf");
  });
});
