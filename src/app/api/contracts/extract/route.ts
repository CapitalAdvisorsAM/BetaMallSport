import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { normalizeRut } from "@/lib/arrendatarios/schema";
import { extractContractFromImage, type ImageMimeType } from "@/lib/contracts/image-extractor";
import { extractContractFromPdf } from "@/lib/contracts/pdf-extractor";
import { MAX_PDF_BYTES } from "@/lib/constants";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ACCEPTED_IMAGE_TYPES = new Set<string>(["image/jpeg", "image/png", "image/webp"]);

function isImageMimeType(value: string): value is ImageMimeType {
  return ACCEPTED_IMAGE_TYPES.has(value);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");
    if (!proyectoId) {
      throw new ApiError(400, "proyectoId es obligatorio.");
    }

    const formData = await request.formData();
    const fileRaw = formData.get("file");
    const file = fileRaw instanceof File ? fileRaw : null;
    if (!file) {
      throw new ApiError(400, "Debes adjuntar un archivo en el campo 'file'.");
    }
    if (file.type !== "application/pdf" && !isImageMimeType(file.type)) {
      throw new ApiError(
        400,
        "Formato no soportado. Adjunta un PDF o una imagen (JPG, PNG, WEBP)."
      );
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new ApiError(400, "El archivo supera el maximo permitido de 10MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const extraction = isImageMimeType(file.type)
      ? await extractContractFromImage(buffer, file.type)
      : await extractContractFromPdf(buffer);

    const normalizedRut = extraction.arrendatarioRut ? normalizeRut(extraction.arrendatarioRut) : null;
    const [arrendatario, local] = await Promise.all([
      normalizedRut
        ? prisma.arrendatario.findFirst({
            where: { proyectoId, rut: normalizedRut },
            select: { id: true }
          })
        : Promise.resolve(null),
      extraction.localCodigo
        ? prisma.local.findFirst({
            where: { proyectoId, codigo: extraction.localCodigo },
            select: { id: true }
          })
        : Promise.resolve(null)
    ]);

    return NextResponse.json({
      ...extraction,
      arrendatarioId: arrendatario?.id ?? null,
      localId: local?.id ?? null
    });
  } catch (error) {
    return handleApiError(error);
  }
}
