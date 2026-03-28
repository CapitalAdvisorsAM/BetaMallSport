import { NextResponse } from "next/server";
import { parseRentRollPreviewPayload } from "@/lib/carga-datos";
import { requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildErrorCsv } from "@/lib/rent-roll-upload";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const cargaId = searchParams.get("cargaId");
    if (!cargaId) {
      return NextResponse.json({ message: "cargaId es obligatorio." }, { status: 400 });
    }

    const carga = await prisma.cargaDatos.findUnique({ where: { id: cargaId } });
    if (!carga?.errorDetalle) {
      return NextResponse.json({ message: "No se encontraron errores para la carga." }, { status: 404 });
    }

    const payload = parseRentRollPreviewPayload(carga.errorDetalle);
    if (!payload) {
      return NextResponse.json({ message: "No fue posible leer el detalle de errores." }, { status: 422 });
    }
    const errors = [...payload.errors, ...(payload.report?.rejectedRows ?? [])];
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
