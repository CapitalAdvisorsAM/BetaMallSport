import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { getContractPdfStorage, validateContractPdf } from "@/lib/contracts/pdf-upload";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const contractId = context.params.id;

    const contract = await prisma.contrato.findUnique({
      where: { id: contractId },
      select: { id: true }
    });
    if (!contract) {
      return NextResponse.json({ message: "Contrato no encontrado." }, { status: 404 });
    }

    const formData = await request.formData();
    const pdfFile = formData.get("pdf");
    const file = pdfFile instanceof File ? pdfFile : null;
    const validationError = validateContractPdf(file);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ message: "Debes adjuntar un archivo PDF." }, { status: 400 });
    }

    const storage = getContractPdfStorage(contractId);
    await mkdir(storage.absoluteDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(storage.absoluteFilePath, Buffer.from(bytes));

    const updated = await prisma.contrato.update({
      where: { id: contractId },
      data: { pdfUrl: storage.publicUrl },
      select: { pdfUrl: true }
    });

    return NextResponse.json({ pdfUrl: updated.pdfUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
