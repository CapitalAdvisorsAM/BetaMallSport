export const dynamic = "force-dynamic";

import { DataUploadType } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildUploadTenantKey,
  parseTenantsFile,
  normalizeUploadRut
} from "@/lib/upload/parse-tenants";
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

    const [existingArrendatarios, arrendatariosConContratosVigentes] = await Promise.all([
      prisma.tenant.findMany({
        where: { projectId: projectId },
        select: {
          rut: true,
          razonSocial: true,
          nombreComercial: true,
          vigente: true,
          email: true,
          telefono: true,
          category: true
        }
      }),
      prisma.tenant.findMany({
        where: {
          projectId: projectId,
          contratos: {
            some: { estado: { in: ["VIGENTE", "GRACIA"] } }
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

      const rutKey = buildUploadTenantKey(
        normalized.rut,
        normalized.razonSocial,
        normalized.nombreComercial
      );
      existingMap.set(rutKey, normalized);

      const nameKey = buildUploadTenantKey(
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

    const preview = parseTenantsFile(await file.arrayBuffer(), existingMap, activeContractRuts);

    const carga = await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.TENANTS,
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

