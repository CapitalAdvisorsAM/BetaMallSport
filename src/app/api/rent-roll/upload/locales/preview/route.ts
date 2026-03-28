import { TipoCargaDatos } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseLocalesFile } from "@/lib/upload/parse-locales";
import { validateFileGuards } from "@/lib/upload/parse-utils";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await request.formData();
    const file = formData.get("file");
    const proyectoId = String(formData.get("proyectoId") ?? "").trim();

    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Debes adjuntar un archivo." }, { status: 400 });
    }

    const fileGuardError = validateFileGuards(file);
    if (fileGuardError) {
      return NextResponse.json({ message: fileGuardError }, { status: 400 });
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true }
    });
    if (!proyecto) {
      return NextResponse.json({ message: "Proyecto no encontrado." }, { status: 404 });
    }

    const existingLocales = await prisma.local.findMany({
      where: { proyectoId },
      select: {
        codigo: true,
        nombre: true,
        glam2: true,
        piso: true,
        tipo: true,
        zona: true,
        esGLA: true,
        estado: true
      }
    });
    const existingMap = new Map(
      existingLocales.map((local) => [
        local.codigo.toUpperCase(),
        {
          ...local,
          glam2: local.glam2.toString()
        }
      ])
    );

    const preview = parseLocalesFile(await file.arrayBuffer(), existingMap);

    const carga = await prisma.cargaDatos.create({
      data: {
        proyectoId,
        tipo: TipoCargaDatos.LOCALES,
        usuarioId: session.user.id,
        archivoNombre: file.name,
        archivoUrl: `upload://${Date.now()}-${file.name}`,
        registrosCargados: preview.summary.total - preview.summary.errores,
        estado: "PENDIENTE",
        errorDetalle: JSON.stringify(preview)
      }
    });

    return NextResponse.json({ cargaId: carga.id, preview });
  } catch (error) {
    return handleApiError(error);
  }
}
