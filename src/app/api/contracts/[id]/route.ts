import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import { contractPayloadSchema } from "@/lib/contracts/schema";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ContractPayload = (typeof contractPayloadSchema)["_type"];

export async function GET(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireSession();
    const item = await prisma.contrato.findUnique({
      where: { id: context.params.id },
      include: {
        local: true,
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

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  return value ? new Prisma.Decimal(value) : null;
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

function tarifaKey(tipo: string, vigenciaDesde: Date | string): string {
  return `${tipo}|${toDateOnly(vigenciaDesde)}`;
}

function ggccKey(vigenciaDesde: Date | string): string {
  return toDateOnly(vigenciaDesde) ?? "";
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

function normalizedGgcc(
  rows: Array<{
    tarifaBaseUfM2: Prisma.Decimal | string;
    pctAdministracion: Prisma.Decimal | string;
    vigenciaDesde: Date | string;
    vigenciaHasta: Date | string | null;
    proximoReajuste: Date | string | null;
  }>
): string {
  return JSON.stringify(
    rows
      .map((item) => ({
        key: ggccKey(item.vigenciaDesde),
        tarifaBaseUfM2: toDecimalString(item.tarifaBaseUfM2),
        pctAdministracion: toDecimalString(item.pctAdministracion),
        vigenciaDesde: toDateOnly(item.vigenciaDesde),
        vigenciaHasta: toDateOnly(item.vigenciaHasta),
        proximoReajuste: toDateOnly(item.proximoReajuste)
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  );
}

function computeCamposModificados(
  existing: Prisma.ContratoGetPayload<{ include: { tarifas: true; ggcc: true } }>,
  payload: ContractPayload
): string[] {
  const campos: string[] = [];

  const scalarChecks: Array<[field: string, before: unknown, after: unknown]> = [
    ["localId", existing.localId, payload.localId],
    ["arrendatarioId", existing.arrendatarioId, payload.arrendatarioId],
    ["numeroContrato", existing.numeroContrato, payload.numeroContrato],
    ["fechaInicio", toDateOnly(existing.fechaInicio), toDateOnly(payload.fechaInicio)],
    ["fechaTermino", toDateOnly(existing.fechaTermino), toDateOnly(payload.fechaTermino)],
    ["fechaEntrega", toDateOnly(existing.fechaEntrega), toDateOnly(payload.fechaEntrega)],
    ["fechaApertura", toDateOnly(existing.fechaApertura), toDateOnly(payload.fechaApertura)],
    ["estado", existing.estado, payload.estado],
    ["pctRentaVariable", toDecimalString(existing.pctRentaVariable), toDecimalString(payload.pctRentaVariable)],
    [
      "pctFondoPromocion",
      toDecimalString(existing.pctFondoPromocion),
      toDecimalString(payload.pctFondoPromocion)
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

  if (normalizedTarifas(existing.tarifas) !== normalizedTarifas(payload.tarifas)) {
    campos.push("tarifas");
  }
  if (normalizedGgcc(existing.ggcc) !== normalizedGgcc(payload.ggcc)) {
    campos.push("ggcc");
  }
  if (payload.anexo) {
    campos.push("anexo");
  }

  return campos;
}

function validateContractInput(body: unknown, proyectoId: string): ContractPayload {
  const parsed = contractPayloadSchema.parse(body);
  if (proyectoId && parsed.proyectoId !== proyectoId) {
    throw new ApiError(400, "El proyecto del payload no coincide con el contrato existente.");
  }
  return parsed;
}

function buildContratoPayload(parsed: ContractPayload): Prisma.ContratoUncheckedUpdateInput {
  return {
    localId: parsed.localId,
    arrendatarioId: parsed.arrendatarioId,
    numeroContrato: parsed.numeroContrato,
    fechaInicio: new Date(parsed.fechaInicio),
    fechaTermino: new Date(parsed.fechaTermino),
    fechaEntrega: toDate(parsed.fechaEntrega),
    fechaApertura: toDate(parsed.fechaApertura),
    estado: parsed.estado,
    pctRentaVariable: toDecimal(parsed.pctRentaVariable),
    pctFondoPromocion: toDecimal(parsed.pctFondoPromocion),
    codigoCC: parsed.codigoCC,
    pdfUrl: parsed.pdfUrl,
    notas: parsed.notas
  };
}

async function persistTarifas(
  tx: Prisma.TransactionClient,
  contratoId: string,
  tarifas: ContractPayload["tarifas"]
): Promise<void> {
  const existingTarifas = await tx.contratoTarifa.findMany({
    where: { contratoId }
  });
  const existingTarifasByKey = new Map(
    existingTarifas.map((item) => [tarifaKey(item.tipo, item.vigenciaDesde), item])
  );
  const payloadTarifasByKey = new Map(
    tarifas.map((item) => [tarifaKey(item.tipo, item.vigenciaDesde), item] as const)
  );

  const tarifasToDelete = existingTarifas
    .filter((item) => !payloadTarifasByKey.has(tarifaKey(item.tipo, item.vigenciaDesde)))
    .map((item) => item.id);

  if (tarifasToDelete.length > 0) {
    await tx.contratoTarifa.deleteMany({
      where: { id: { in: tarifasToDelete } }
    });
  }

  const tarifasToUpdate: Array<{ id: string; payloadItem: ContractPayload["tarifas"][number] }> = [];
  const tarifasToCreate: Array<ContractPayload["tarifas"][number]> = [];
  for (const item of tarifas) {
    const found = existingTarifasByKey.get(tarifaKey(item.tipo, item.vigenciaDesde));
    if (found) {
      tarifasToUpdate.push({ id: found.id, payloadItem: item });
    } else {
      tarifasToCreate.push(item);
    }
  }

  await Promise.all(
    tarifasToUpdate.map((item) =>
      tx.contratoTarifa.update({
        where: { id: item.id },
        data: {
          valor: new Prisma.Decimal(item.payloadItem.valor),
          vigenciaHasta: toDate(item.payloadItem.vigenciaHasta),
          esDiciembre: item.payloadItem.esDiciembre
        }
      })
    )
  );

  if (tarifasToCreate.length > 0) {
    await tx.contratoTarifa.createMany({
      data: tarifasToCreate.map((item) => ({
        contratoId,
        tipo: item.tipo as TipoTarifaContrato,
        valor: new Prisma.Decimal(item.valor),
        vigenciaDesde: new Date(item.vigenciaDesde),
        vigenciaHasta: toDate(item.vigenciaHasta),
        esDiciembre: item.esDiciembre
      }))
    });
  }
}

async function persistGGCC(
  tx: Prisma.TransactionClient,
  contratoId: string,
  ggcc: ContractPayload["ggcc"]
): Promise<void> {
  const existingGgcc = await tx.contratoGGCC.findMany({
    where: { contratoId }
  });
  const existingGgccByKey = new Map(existingGgcc.map((item) => [ggccKey(item.vigenciaDesde), item]));
  const payloadGgccByKey = new Map(ggcc.map((item) => [ggccKey(item.vigenciaDesde), item] as const));

  const ggccToDelete = existingGgcc
    .filter((item) => !payloadGgccByKey.has(ggccKey(item.vigenciaDesde)))
    .map((item) => item.id);

  if (ggccToDelete.length > 0) {
    await tx.contratoGGCC.deleteMany({
      where: { id: { in: ggccToDelete } }
    });
  }

  const ggccToUpdate: Array<{ id: string; payloadItem: ContractPayload["ggcc"][number] }> = [];
  const ggccToCreate: Array<ContractPayload["ggcc"][number]> = [];
  for (const item of ggcc) {
    const found = existingGgccByKey.get(ggccKey(item.vigenciaDesde));
    if (found) {
      ggccToUpdate.push({ id: found.id, payloadItem: item });
    } else {
      ggccToCreate.push(item);
    }
  }

  await Promise.all(
    ggccToUpdate.map((item) =>
      tx.contratoGGCC.update({
        where: { id: item.id },
        data: {
          tarifaBaseUfM2: new Prisma.Decimal(item.payloadItem.tarifaBaseUfM2),
          pctAdministracion: new Prisma.Decimal(item.payloadItem.pctAdministracion),
          vigenciaHasta: toDate(item.payloadItem.vigenciaHasta),
          proximoReajuste: toDate(item.payloadItem.proximoReajuste)
        }
      })
    )
  );

  if (ggccToCreate.length > 0) {
    await tx.contratoGGCC.createMany({
      data: ggccToCreate.map((item) => ({
        contratoId,
        tarifaBaseUfM2: new Prisma.Decimal(item.tarifaBaseUfM2),
        pctAdministracion: new Prisma.Decimal(item.pctAdministracion),
        vigenciaDesde: new Date(item.vigenciaDesde),
        vigenciaHasta: toDate(item.vigenciaHasta),
        proximoReajuste: toDate(item.proximoReajuste)
      }))
    });
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const body = (await request.json()) as { proyectoId?: string };
    const payload = validateContractInput(body, body.proyectoId ?? "");
    const contractId = context.params.id;

    const existing = await prisma.contrato.findUnique({
      where: { id: contractId },
      include: { tarifas: true, ggcc: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Contrato no encontrado." }, { status: 404 });
    }
    validateContractInput(payload, existing.proyectoId);
    const [local, arrendatario] = await Promise.all([
      prisma.local.findFirst({
        where: { id: payload.localId, proyectoId: payload.proyectoId },
        select: { id: true }
      }),
      prisma.arrendatario.findFirst({
        where: { id: payload.arrendatarioId, proyectoId: payload.proyectoId },
        select: { id: true }
      })
    ]);
    if (!local) {
      throw new ApiError(400, "El local no pertenece al proyecto.");
    }
    if (!arrendatario) {
      throw new ApiError(400, "El arrendatario no pertenece al proyecto.");
    }

    const camposModificados = computeCamposModificados(existing, payload);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.contrato.update({
        where: { id: contractId },
        data: buildContratoPayload(payload)
      });

      await persistTarifas(tx, contractId, payload.tarifas);
      await persistGGCC(tx, contractId, payload.ggcc);

      const snapshotDespues = await tx.contrato.findUnique({
        where: { id: contractId },
        include: { tarifas: true, ggcc: true }
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

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "Payload invalido", issues: error.issues }, { status: 400 });
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    await requireWriteAccess();
    await prisma.contrato.delete({
      where: { id: context.params.id }
    });
    return NextResponse.json({ message: "Contrato eliminado correctamente." });
  } catch (error) {
    return handleApiError(error);
  }
}
