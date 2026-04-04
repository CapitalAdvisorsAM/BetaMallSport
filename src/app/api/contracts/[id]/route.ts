export const dynamic = "force-dynamic";

import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import {
  normalizedLocalIds,
  payloadTarifas,
  persistContratoLocales,
  persistGGCC,
  persistTarifas,
  tarifaKey,
  toDate,
  toDecimal
} from "@/lib/contracts/persistence";
import { contractPayloadSchema } from "@/lib/contracts/schema";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ContractPayload = (typeof contractPayloadSchema)["_type"];

function getProyectoIdFromRequest(request: Request): string | null {
  const proyectoId = new URL(request.url).searchParams.get("proyectoId")?.trim() ?? "";
  return proyectoId.length > 0 ? proyectoId : null;
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const proyectoId = getProyectoIdFromRequest(request);
    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const item = await prisma.contrato.findFirst({
      where: { id: context.params.id, proyectoId },
      include: {
        local: true,
        locales: {
          include: { local: true },
          orderBy: { createdAt: "asc" }
        },
        arrendatario: true,
        tarifas: { orderBy: { vigenciaDesde: "desc" } },
        ggcc: { orderBy: { vigenciaDesde: "desc" } },
        anexos: { orderBy: { createdAt: "desc" }, take: 5 }
      }
    });
    if (!item) {
      throw new ApiError(404, "No encontrado.");
    }
    return NextResponse.json(item);
  } catch (error) {
    return handleApiError(error);
  }
}

function toDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function toDecimalString(value: Prisma.Decimal | string | null): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return new Prisma.Decimal(value).toString();
  }
  return value.toString();
}

function normalizedTarifas(
  tarifas: Array<{
    tipo: string;
    valor: Prisma.Decimal | string;
    vigenciaDesde: Date | string;
    vigenciaHasta: Date | string | null;
    esDiciembre: boolean;
  }>
): string {
  return JSON.stringify(
    tarifas
      .map((item) => ({
        key: tarifaKey(item.tipo, item.vigenciaDesde),
        tipo: item.tipo,
        valor: toDecimalString(item.valor),
        vigenciaDesde: toDateOnly(item.vigenciaDesde),
        vigenciaHasta: toDateOnly(item.vigenciaHasta),
        esDiciembre: item.esDiciembre
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  );
}

function normalizedRentaVariable(
  rows: Array<{
    tipo: string;
    valor: Prisma.Decimal | string;
    vigenciaDesde: Date | string;
    vigenciaHasta: Date | string | null;
  }>
): string {
  return JSON.stringify(
    rows
      .filter((item) => item.tipo === TipoTarifaContrato.PORCENTAJE)
      .map((item) => ({
        key: toDateOnly(item.vigenciaDesde) ?? "",
        pctRentaVariable: toDecimalString(item.valor),
        vigenciaDesde: toDateOnly(item.vigenciaDesde),
        vigenciaHasta: toDateOnly(item.vigenciaHasta)
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  );
}

function normalizedGgcc(
  rows: Array<{
    tarifaBaseUfM2: Prisma.Decimal | string;
    pctAdministracion: Prisma.Decimal | string;
    pctReajuste: Prisma.Decimal | string | null;
    proximoReajuste: Date | string | null;
    mesesReajuste?: number | null;
  }>
): string {
  return JSON.stringify(
    rows
      .map((item) => ({
        key: [
          toDecimalString(item.tarifaBaseUfM2) ?? "",
          toDecimalString(item.pctAdministracion) ?? "",
          toDecimalString(item.pctReajuste) ?? "",
          toDateOnly(item.proximoReajuste) ?? "",
          String("mesesReajuste" in item ? (item.mesesReajuste ?? null) : null)
        ].join("|"),
        tarifaBaseUfM2: toDecimalString(item.tarifaBaseUfM2),
        pctAdministracion: toDecimalString(item.pctAdministracion),
        pctReajuste: toDecimalString(item.pctReajuste),
        proximoReajuste: toDateOnly(item.proximoReajuste),
        mesesReajuste: "mesesReajuste" in item ? (item.mesesReajuste ?? null) : null
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  );
}

function computeCamposModificados(
  existing: Prisma.ContratoGetPayload<{ include: { tarifas: true; ggcc: true; locales: true } }>,
  payload: ContractPayload,
  localIds: string[]
): string[] {
  const campos: string[] = [];

  const scalarChecks: Array<[field: string, before: unknown, after: unknown]> = [
    ["arrendatarioId", existing.arrendatarioId, payload.arrendatarioId],
    ["numeroContrato", existing.numeroContrato, payload.numeroContrato?.trim() || existing.numeroContrato],
    ["fechaInicio", toDateOnly(existing.fechaInicio), toDateOnly(payload.fechaInicio)],
    ["fechaTermino", toDateOnly(existing.fechaTermino), toDateOnly(payload.fechaTermino)],
    ["fechaEntrega", toDateOnly(existing.fechaEntrega), toDateOnly(payload.fechaEntrega)],
    ["fechaApertura", toDateOnly(existing.fechaApertura), toDateOnly(payload.fechaApertura)],
    ["estado", existing.estado, payload.estado],
    [
      "pctFondoPromocion",
      toDecimalString(existing.pctFondoPromocion),
      toDecimalString(payload.pctFondoPromocion)
    ],
    [
      "pctAdministracionGgcc",
      toDecimalString(existing.pctAdministracionGgcc),
      toDecimalString(payload.pctAdministracionGgcc)
    ],
    [
      "multiplicadorDiciembre",
      toDecimalString(existing.multiplicadorDiciembre),
      toDecimalString(payload.multiplicadorDiciembre)
    ],
    ["codigoCC", existing.codigoCC, payload.codigoCC],
    ["pdfUrl", existing.pdfUrl, payload.pdfUrl],
    ["notas", existing.notas, payload.notas]
  ];

  for (const [field, before, after] of scalarChecks) {
    if (before !== after) {
      campos.push(field);
    }
  }

  const existingLocalIds =
    existing.locales.length > 0
      ? existing.locales.map((item) => item.localId).sort()
      : [existing.localId];
  const payloadLocalIds = [...localIds].sort();
  if (JSON.stringify(existingLocalIds) !== JSON.stringify(payloadLocalIds)) {
    campos.push("localIds");
  }

  const existingTarifasFijas = existing.tarifas.filter(
    (item) => item.tipo === TipoTarifaContrato.FIJO_UF_M2 || item.tipo === TipoTarifaContrato.FIJO_UF
  );
  const payloadTarifasFijas = payload.tarifas.filter(
    (item) => item.tipo === TipoTarifaContrato.FIJO_UF_M2 || item.tipo === TipoTarifaContrato.FIJO_UF
  );

  if (normalizedTarifas(existingTarifasFijas) !== normalizedTarifas(payloadTarifasFijas)) {
    campos.push("tarifas");
  }
  if (normalizedRentaVariable(existing.tarifas) !== normalizedRentaVariable(payloadTarifas(payload))) {
    campos.push("rentaVariable");
  }
  if (normalizedGgcc(existing.ggcc) !== normalizedGgcc(payload.ggcc)) {
    campos.push("ggcc");
  }
  if (payload.anexo) {
    campos.push("anexo");
  }

  return campos;
}

function validateContractInput(body: unknown): ContractPayload {
  const parsed = contractPayloadSchema.parse(body);
  return parsed;
}

function buildContratoPayload(
  parsed: ContractPayload,
  existingNumeroContrato: string,
  localIds: string[]
): Prisma.ContratoUncheckedUpdateInput {
  return {
    localId: localIds[0],
    arrendatarioId: parsed.arrendatarioId,
    numeroContrato: parsed.numeroContrato?.trim() || existingNumeroContrato,
    fechaInicio: new Date(parsed.fechaInicio),
    fechaTermino: new Date(parsed.fechaTermino),
    fechaEntrega: toDate(parsed.fechaEntrega),
    fechaApertura: toDate(parsed.fechaApertura),
    estado: parsed.estado,
    pctFondoPromocion: toDecimal(parsed.pctFondoPromocion),
    pctAdministracionGgcc: toDecimal(parsed.pctAdministracionGgcc),
    multiplicadorDiciembre: toDecimal(parsed.multiplicadorDiciembre),
    codigoCC: parsed.codigoCC,
    pdfUrl: parsed.pdfUrl,
    notas: parsed.notas
  };
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const payload = validateContractInput(await request.json());
    const contractId = context.params.id;
    const localIds = normalizedLocalIds(payload);

    if (localIds.length === 0) {
      return NextResponse.json({ message: "Debes seleccionar al menos un local." }, { status: 400 });
    }

    const existing = await prisma.contrato.findFirst({
      where: { id: contractId, proyectoId: payload.proyectoId },
      include: { tarifas: true, ggcc: true, locales: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Contrato no encontrado." }, { status: 404 });
    }

    const [locals, arrendatario] = await Promise.all([
      prisma.local.findMany({
        where: { id: { in: localIds }, proyectoId: payload.proyectoId },
        select: { id: true }
      }),
      prisma.arrendatario.findFirst({
        where: { id: payload.arrendatarioId, proyectoId: payload.proyectoId },
        select: { id: true }
      })
    ]);
    if (locals.length !== localIds.length) {
      throw new ApiError(400, "Uno o mas locales no pertenecen al proyecto.");
    }
    if (!arrendatario) {
      throw new ApiError(400, "El arrendatario no pertenece al proyecto.");
    }

    const camposModificados = computeCamposModificados(existing, payload, localIds);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.contrato.update({
        where: { id: contractId },
        data: buildContratoPayload(payload, existing.numeroContrato, localIds)
      });

      await persistContratoLocales(tx, contractId, localIds);
      await persistTarifas(tx, contractId, payloadTarifas(payload));
      await persistGGCC(tx, contractId, payload.ggcc, payload.fechaInicio, payload.fechaTermino);

      const snapshotDespues = await tx.contrato.findUnique({
        where: { id: contractId },
        include: { tarifas: true, ggcc: true, locales: true }
      });
      if (!snapshotDespues) {
        throw new Error("Contrato no encontrado.");
      }

      if (payload.anexo) {
        await tx.contratoAnexo.create({
          data: {
            contratoId: contractId,
            fecha: new Date(payload.anexo.fecha),
            descripcion: payload.anexo.descripcion,
            camposModificados,
            snapshotAntes: existing,
            snapshotDespues,
            usuarioId: session.user.id
          }
        });
      }

      return snapshotDespues;
    });
    invalidateMetricsCacheByProject(payload.proyectoId);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Payload invalido", issues: error.issues }, { status: 400 });
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    const proyectoId = getProyectoIdFromRequest(request);
    if (!proyectoId) {
      return NextResponse.json({ message: "proyectoId es obligatorio." }, { status: 400 });
    }

    const deleted = await prisma.contrato.deleteMany({
      where: { id: context.params.id, proyectoId }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ message: "Contrato no encontrado." }, { status: 404 });
    }
    invalidateMetricsCacheByProject(proyectoId);

    return NextResponse.json({ message: "Contrato eliminado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}
