export const dynamic = "force-dynamic";

import { DataUploadType } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildContractLookupKey,
  normalizeUploadTenantName,
  revalidateContractPreviewRows,
  type ExistingContractForDiff
} from "@/lib/upload/parse-contracts";
import { parseStoredUploadPayload } from "@/lib/upload/payload";

export const runtime = "nodejs";

type ExistingContratoMap = Map<string, ExistingContractForDiff>;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDataRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

async function loadLookupData(projectId: string): Promise<{
  existingContratos: ExistingContratoMap;
  existingLocalData: Map<string, { glam2: string }>;
  existingArrendatarioNombres: Map<string, number>;
}> {
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

  const existingContratos: ExistingContratoMap = new Map();
  for (const contrato of contratos) {
    const snapshot: ExistingContractForDiff = {
      numeroContrato: contrato.numeroContrato,
      localCodigo: contrato.local.codigo.toUpperCase(),
      arrendatarioNombre: contrato.arrendatario.nombreComercial,
      fechaInicio: toIsoDate(contrato.fechaInicio),
      fechaTermino: toIsoDate(contrato.fechaTermino),
      fechaEntrega: contrato.fechaEntrega ? toIsoDate(contrato.fechaEntrega) : null,
      fechaApertura: contrato.fechaApertura ? toIsoDate(contrato.fechaApertura) : null,
      pctFondoPromocion: contrato.pctFondoPromocion?.toString() ?? null,
      multiplicadorDiciembre: contrato.multiplicadorDiciembre?.toString() ?? null,
      multiplicadorJunio: contrato.multiplicadorJunio?.toString() ?? null,
      multiplicadorJulio: contrato.multiplicadorJulio?.toString() ?? null,
      multiplicadorAgosto: contrato.multiplicadorAgosto?.toString() ?? null,
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

    existingContratos.set(buildContractLookupKey(snapshot), snapshot);
    existingContratos.set(
      buildContractLookupKey({
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
    const normalizedName = normalizeUploadTenantName(arrendatario.nombreComercial);
    if (!normalizedName) {
      continue;
    }
    existingArrendatarioNombres.set(
      normalizedName,
      (existingArrendatarioNombres.get(normalizedName) ?? 0) + 1
    );
  }

  return { existingContratos, existingLocalData, existingArrendatarioNombres };
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const body = (await request.json()) as {
      cargaId?: unknown;
      rowNumber?: unknown;
      data?: unknown;
    };

    const cargaId = typeof body.cargaId === "string" ? body.cargaId.trim() : "";
    const rowNumber = typeof body.rowNumber === "number" ? body.rowNumber : Number.NaN;
    const rowData = body.data;

    if (!cargaId) {
      return NextResponse.json({ message: "cargaId es obligatorio." }, { status: 400 });
    }
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
      return NextResponse.json({ message: "rowNumber debe ser un entero valido." }, { status: 400 });
    }
    if (!isDataRecord(rowData)) {
      return NextResponse.json({ message: "data debe ser un objeto con la fila editada." }, { status: 400 });
    }

    const carga = await prisma.dataUpload.findUnique({ where: { id: cargaId } });
    if (!carga || carga.type !== DataUploadType.RENT_ROLL || !carga.errorDetail) {
      return NextResponse.json({ message: "No existe preview para esta carga." }, { status: 404 });
    }
    if (carga.status !== "PENDING") {
      return NextResponse.json(
        { message: "Solo se pueden editar previews en status pendiente." },
        { status: 409 }
      );
    }

    const storedPreview = parseStoredUploadPayload(carga.errorDetail);
    if (!storedPreview) {
      return NextResponse.json({ message: "No fue posible leer el preview almacenado." }, { status: 422 });
    }

    const rowExists = storedPreview.rows.some((row) => row.rowNumber === rowNumber);
    if (!rowExists) {
      return NextResponse.json({ message: "No existe la fila indicada en el preview." }, { status: 404 });
    }

    const lookupData = await loadLookupData(carga.projectId);
    const nextPreview = revalidateContractPreviewRows(
      storedPreview.rows.map((row) => ({
        rowNumber: row.rowNumber,
        data: row.rowNumber === rowNumber ? rowData : row.data
      })),
      {
        fileName: carga.fileName,
        existingContratos: lookupData.existingContratos,
        existingLocalData: lookupData.existingLocalData,
        existingArrendatarioNombres: lookupData.existingArrendatarioNombres
      }
    );

    await prisma.dataUpload.update({
      where: { id: carga.id },
      data: {
        errorDetail: JSON.stringify(nextPreview),
        recordsLoaded: nextPreview.summary.total - nextPreview.summary.errores
      }
    });

    return NextResponse.json({
      cargaId: carga.id,
      preview: nextPreview
    });
  } catch (error) {
    return handleApiError(error);
  }
}

