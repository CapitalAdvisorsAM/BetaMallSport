export const dynamic = "force-dynamic";

import { TipoCargaDatos } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildUploadArrendatarioKey,
  parseArrendatariosFile,
  normalizeUploadRut
} from "@/lib/upload/parse-arrendatarios";
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

    const proyecto = await prisma.project.findUnique({
      where: { id: proyectoId },
      select: { id: true }
    });
    if (!proyecto) {
      return NextResponse.json({ message: "Proyecto no encontrado." }, { status: 404 });
    }

    const [existingArrendatarios, arrendatariosConContratosVigentes] = await Promise.all([
      prisma.tenant.findMany({
        where: { proyectoId },
        select: {
          rut: true,
          razonSocial: true,
          nombreComercial: true,
          vigente: true,
          email: true,
          telefono: true
        }
      }),
      prisma.tenant.findMany({
        where: {
          proyectoId,
          contratos: {
            some: { estado: "VIGENTE" }
          }
        },
        select: { rut: true }
      })
    ]);

    const existingMap = new Map<string, (typeof existingArrendatarios)[number]>();
    for (const arrendatario of existingArrendatarios) {
      const normalized = {
        ...arrendatario,
        rut: normalizeUploadRut(arrendatario.rut)
      };

      const rutKey = buildUploadArrendatarioKey(
        normalized.rut,
        normalized.razonSocial,
        normalized.nombreComercial
      );
      existingMap.set(rutKey, normalized);

      const nameKey = buildUploadArrendatarioKey(
        "",
        normalized.razonSocial,
        normalized.nombreComercial
      );
      if (!existingMap.has(nameKey)) {
        existingMap.set(nameKey, normalized);
      }
    }
    const activeContractRuts = new Set(
      arrendatariosConContratosVigentes.map((arrendatario) => normalizeUploadRut(arrendatario.rut))
    );

    const preview = parseArrendatariosFile(await file.arrayBuffer(), existingMap, activeContractRuts);

    const carga = await prisma.cargaDatos.create({
      data: {
        proyectoId,
        tipo: TipoCargaDatos.ARRENDATARIOS,
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
