export const dynamic = "force-dynamic";

import { DataUploadType } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildContratoLookupKey,
  normalizeUploadArrendatarioNombre,
  parseContratosFile
} from "@/lib/upload/parse-contratos";
import { parseStoredUploadPayload } from "@/lib/upload/payload";
import { validateFileGuards } from "@/lib/upload/parse-utils";

export const runtime = "nodejs";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const { searchParams } = new URL(request.url);
    const cargaId = searchParams.get("cargaId")?.trim() ?? "";
    if (!cargaId) {
      return NextResponse.json({ message: "cargaId es obligatorio." }, { status: 400 });
    }

    const carga = await prisma.dataUpload.findUnique({ where: { id: cargaId } });
    if (!carga || carga.type !== DataUploadType.RENT_ROLL || !carga.errorDetail) {
      return NextResponse.json({ message: "No existe preview para esta carga." }, { status: 404 });
    }

    const payload = parseStoredUploadPayload(carga.errorDetail);
    if (!payload) {
      return NextResponse.json({ message: "No fue posible leer el preview almacenado." }, { status: 422 });
    }

    return NextResponse.json({
      cargaId: carga.id,
      preview: {
        rows: payload.rows,
        summary: payload.summary,
        warnings: payload.warnings
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

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

    const [locales, arrendatarios, contratos] = await Promise.all([
      prisma.unit.findMany({
        where: { proyectoId: projectId },
        select: { codigo: true, glam2: true }
      }),
      prisma.tenant.findMany({
        where: { proyectoId: projectId },
        select: { nombreComercial: true }
      }),
      prisma.contract.findMany({
        where: { proyectoId: projectId },
        include: {
          local: { select: { codigo: true } },
          arrendatario: { select: { nombreComercial: true } },
          tarifas: true,
          ggcc: true
        }
      })
    ]);

    const existingContratos = new Map();
    for (const contrato of contratos) {
      const snapshot = {
        numeroContrato: contrato.numeroContrato,
        localCodigo: contrato.local.codigo.toUpperCase(),
        arrendatarioNombre: contrato.arrendatario.nombreComercial,
        estado: contrato.estado,
        fechaInicio: toIsoDate(contrato.fechaInicio),
        fechaTermino: toIsoDate(contrato.fechaTermino),
        fechaEntrega: contrato.fechaEntrega ? toIsoDate(contrato.fechaEntrega) : null,
        fechaApertura: contrato.fechaApertura ? toIsoDate(contrato.fechaApertura) : null,
        pctFondoPromocion: contrato.pctFondoPromocion?.toString() ?? null,
        multiplicadorDiciembre: contrato.multiplicadorDiciembre?.toString() ?? null,
        codigoCC: contrato.codigoCC,
        ggccPctAdministracion:
          contrato.ggcc.length > 0 ? contrato.ggcc[0]?.pctAdministracion.toString() ?? null : null,
        notas: contrato.notas,
        tarifas: contrato.tarifas.map((tarifa) => ({
          tipo: tarifa.tipo,
          valor: tarifa.valor.toString(),
          vigenciaDesde: toIsoDate(tarifa.vigenciaDesde),
          vigenciaHasta: tarifa.vigenciaHasta ? toIsoDate(tarifa.vigenciaHasta) : null
        })),
        ggcc: contrato.ggcc.map((ggcc) => ({
          tarifaBaseUfM2: ggcc.tarifaBaseUfM2.toString(),
          pctAdministracion: ggcc.pctAdministracion.toString(),
          pctReajuste: ggcc.pctReajuste?.toString() ?? null,
          mesesReajuste: ggcc.mesesReajuste ?? null
        }))
      };

      existingContratos.set(buildContratoLookupKey(snapshot), snapshot);
      existingContratos.set(
        buildContratoLookupKey({
          ...snapshot,
          numeroContrato: ""
        }),
        snapshot
      );
    }

    const existingLocalData = new Map(
      locales.map((local) => [local.codigo.toUpperCase(), { glam2: local.glam2.toString() }])
    );
    const existingArrendatarioNombres = new Map<string, number>();
    for (const arrendatario of arrendatarios) {
      const normalizedName = normalizeUploadArrendatarioNombre(arrendatario.nombreComercial);
      if (!normalizedName) {
        continue;
      }
      existingArrendatarioNombres.set(
        normalizedName,
        (existingArrendatarioNombres.get(normalizedName) ?? 0) + 1
      );
    }

    const preview = parseContratosFile(await file.arrayBuffer(), {
      fileName: file.name,
      existingContratos,
      existingLocalData,
      existingArrendatarioNombres
    });

    const carga = await prisma.dataUpload.create({
      data: {
        projectId,
        type: DataUploadType.RENT_ROLL,
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

