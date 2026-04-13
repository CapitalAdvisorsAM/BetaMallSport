export const dynamic = "force-dynamic";

import { DataUploadType } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseUnitsFile } from "@/lib/upload/parse-units";
import { validateFileGuards } from "@/lib/upload/parse-utils";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const formData = await request.formData();
    const file = formData.get("file");
    const projectId = String(formData.get("projectId") ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ message: "projectId es obligatorio." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Debes adjuntar un archivo." }, { status: 400 });
    }

    const fileGuardError = validateFileGuards(file);
    if (fileGuardError) {
      return NextResponse.json({ message: fileGuardError }, { status: 400 });
    }

    const proyecto = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    });
    if (!proyecto) {
      return NextResponse.json({ message: "Proyecto no encontrado." }, { status: 404 });
    }

    const existingLocales = await prisma.unit.findMany({
      where: { proyectoId: projectId },
      select: {
        codigo: true,
        nombre: true,
        glam2: true,
        piso: true,
        tipo: true,
        zona: { select: { nombre: true } },
        esGLA: true,
        estado: true
      }
    });
    const existingMap = new Map(
      existingLocales.map((local) => [
        local.codigo.toUpperCase(),
        {
          ...local,
          zona: local.zona?.nombre ?? null,
          glam2: local.glam2.toString()
        }
      ])
    );

    const preview = parseUnitsFile(await file.arrayBuffer(), existingMap);

    const carga = await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.UNITS,
        userId: session.user.id,
        fileName: file.name,
        fileUrl: `upload://${Date.now()}-${file.name}`,
        recordsLoaded: preview.summary.total - preview.summary.errores,
        status: "PENDING",
        errorDetail: JSON.stringify(preview)
      }
    });

    return NextResponse.json({ cargaId: carga.id, preview });
  } catch (error) {
    return handleApiError(error);
  }
}

