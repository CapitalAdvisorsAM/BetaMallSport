export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { parseRentRollPreviewPayload } from "@/lib/carga-datos";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildErrorCsv } from "@/lib/upload/parse-contratos";
import { parseStoredUploadPayload } from "@/lib/upload/payload";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const cargaId = searchParams.get("cargaId");
    if (!cargaId) {
      return NextResponse.json({ message: "cargaId es obligatorio." }, { status: 400 });
    }

    const carga = await prisma.dataUpload.findUnique({ where: { id: cargaId } });
    if (!carga?.errorDetail) {
      return NextResponse.json({ message: "No se encontraron errores para la carga." }, { status: 404 });
    }

    const legacyPayload = parseRentRollPreviewPayload(carga.errorDetail);
    const errors = legacyPayload
      ? [...legacyPayload.errors, ...(legacyPayload.report?.rejectedRows ?? [])]
      : (() => {
          const modernPayload = parseStoredUploadPayload(carga.errorDetail);
          if (!modernPayload) {
            return null;
          }
          const previewErrors = modernPayload.rows
            .filter((row) => row.status === "ERROR")
            .map((row) => ({
              rowNumber: row.rowNumber,
              message: row.errorMessage ?? "Fila invalida."
            }));
          return [...previewErrors, ...(modernPayload.report?.rejectedRows ?? [])];
        })();

    if (!errors) {
      return NextResponse.json({ message: "No fue posible leer el detalle de errores." }, { status: 422 });
    }

    const csv = buildErrorCsv(errors);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="carga-${cargaId}-errores.csv"`
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible generar el archivo." }, { status: 500 });
  }
}

