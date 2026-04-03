export const dynamic = "force-dynamic";

import { TipoCargaDatos } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeUploadRut } from "@/lib/upload/parse-arrendatarios";
import { buildContratoLookupKey, parseContratosFile } from "@/lib/upload/parse-contratos";
import { validateFileGuards } from "@/lib/upload/parse-utils";

export const runtime = "nodejs";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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

    const [locales, arrendatarios, contratos] = await Promise.all([
      prisma.local.findMany({
        where: { proyectoId },
        select: { codigo: true, glam2: true }
      }),
      prisma.arrendatario.findMany({
        where: { proyectoId },
        select: { rut: true }
      }),
      prisma.contrato.findMany({
        where: { proyectoId },
        include: {
          local: { select: { codigo: true } },
          arrendatario: { select: { rut: true } },
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
        arrendatarioRut: normalizeUploadRut(contrato.arrendatario.rut),
        estado: contrato.estado,
        fechaInicio: toIsoDate(contrato.fechaInicio),
        fechaTermino: toIsoDate(contrato.fechaTermino),
        fechaEntrega: contrato.fechaEntrega ? toIsoDate(contrato.fechaEntrega) : null,
        fechaApertura: contrato.fechaApertura ? toIsoDate(contrato.fechaApertura) : null,
        pctFondoPromocion: contrato.pctFondoPromocion?.toString() ?? null,
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
          vigenciaDesde: toIsoDate(ggcc.vigenciaDesde),
          vigenciaHasta: ggcc.vigenciaHasta ? toIsoDate(ggcc.vigenciaHasta) : null,
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
    const existingArrendatarioRuts = new Set(
      arrendatarios.map((arrendatario) => normalizeUploadRut(arrendatario.rut))
    );

    const preview = parseContratosFile(await file.arrayBuffer(), {
      fileName: file.name,
      existingContratos,
      existingLocalData,
      existingArrendatarioRuts
    });

    const carga = await prisma.cargaDatos.create({
      data: {
        proyectoId,
        tipo: TipoCargaDatos.RENT_ROLL,
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
