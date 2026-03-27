import { TipoCargaDatos } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseRentRollFile } from "@/lib/rent-roll-upload";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await request.formData();
    const file = formData.get("file");
    const proyectoId = String(formData.get("proyectoId") ?? "");

    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Debes adjuntar un archivo." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const preview = parseRentRollFile(file.name, Buffer.from(arrayBuffer));

    const carga = await prisma.cargaDatos.create({
      data: {
        proyectoId,
        tipo: TipoCargaDatos.RENT_ROLL,
        usuarioId: session.user.id,
        archivoNombre: file.name,
        archivoUrl: `upload://${Date.now()}-${file.name}`,
        registrosCargados: preview.summary.validRows,
        estado: "PENDIENTE",
        errorDetalle: JSON.stringify(preview)
      }
    });

    return NextResponse.json({
      cargaId: carga.id,
      preview
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible procesar el archivo." }, { status: 500 });
  }
}
