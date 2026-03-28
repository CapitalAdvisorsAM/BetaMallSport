import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { contractPayloadSchema } from "@/lib/contracts/schema";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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
  payload: (typeof contractPayloadSchema)["_type"]
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

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await requireWriteAccess();
    const payloadResult = contractPayloadSchema.safeParse(await request.json());
    if (!payloadResult.success) {
      return NextResponse.json(
        { message: "Payload invalido", issues: payloadResult.error.issues },
        { status: 400 }
      );
    }
    const payload = payloadResult.data;
    const contractId = context.params.id;

    const existing = await prisma.contrato.findUnique({
      where: { id: contractId },
      include: { tarifas: true, ggcc: true }
    });
    if (!existing) {
      return NextResponse.json({ message: "Contrato no encontrado." }, { status: 404 });
    }
    if (existing.proyectoId !== payload.proyectoId) {
      return NextResponse.json(
        { message: "El proyecto del payload no coincide con el contrato existente." },
        { status: 400 }
      );
    }
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
        data: {
          localId: payload.localId,
          arrendatarioId: payload.arrendatarioId,
          numeroContrato: payload.numeroContrato,
          fechaInicio: new Date(payload.fechaInicio),
          fechaTermino: new Date(payload.fechaTermino),
          fechaEntrega: toDate(payload.fechaEntrega),
          fechaApertura: toDate(payload.fechaApertura),
          estado: payload.estado,
          pctRentaVariable: toDecimal(payload.pctRentaVariable),
          pctFondoPromocion: toDecimal(payload.pctFondoPromocion),
          codigoCC: payload.codigoCC,
          pdfUrl: payload.pdfUrl,
          notas: payload.notas
        }
      });

      const existingTarifas = await tx.contratoTarifa.findMany({
        where: { contratoId: contractId }
      });
      const existingTarifasByKey = new Map(
        existingTarifas.map((item) => [tarifaKey(item.tipo, item.vigenciaDesde), item])
      );
      const payloadTarifasByKey = new Map(
        payload.tarifas.map((item) => [tarifaKey(item.tipo, item.vigenciaDesde), item] as const)
      );

      const tarifasToDelete = existingTarifas
        .filter((item) => !payloadTarifasByKey.has(tarifaKey(item.tipo, item.vigenciaDesde)))
        .map((item) => item.id);

      if (tarifasToDelete.length > 0) {
        await tx.contratoTarifa.deleteMany({
          where: { id: { in: tarifasToDelete } }
        });
      }

      const tarifasToUpdate: Array<{ id: string; payloadItem: (typeof payload.tarifas)[number] }> = [];
      const tarifasToCreate: Array<(typeof payload.tarifas)[number]> = [];
      for (const item of payload.tarifas) {
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
            contratoId: contractId,
            tipo: item.tipo as TipoTarifaContrato,
            valor: new Prisma.Decimal(item.valor),
            vigenciaDesde: new Date(item.vigenciaDesde),
            vigenciaHasta: toDate(item.vigenciaHasta),
            esDiciembre: item.esDiciembre
          }))
        });
      }

      const existingGgcc = await tx.contratoGGCC.findMany({
        where: { contratoId: contractId }
      });
      const existingGgccByKey = new Map(existingGgcc.map((item) => [ggccKey(item.vigenciaDesde), item]));
      const payloadGgccByKey = new Map(payload.ggcc.map((item) => [ggccKey(item.vigenciaDesde), item] as const));

      const ggccToDelete = existingGgcc
        .filter((item) => !payloadGgccByKey.has(ggccKey(item.vigenciaDesde)))
        .map((item) => item.id);

      if (ggccToDelete.length > 0) {
        await tx.contratoGGCC.deleteMany({
          where: { id: { in: ggccToDelete } }
        });
      }

      const ggccToUpdate: Array<{ id: string; payloadItem: (typeof payload.ggcc)[number] }> = [];
      const ggccToCreate: Array<(typeof payload.ggcc)[number]> = [];
      for (const item of payload.ggcc) {
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
            contratoId: contractId,
            tarifaBaseUfM2: new Prisma.Decimal(item.tarifaBaseUfM2),
            pctAdministracion: new Prisma.Decimal(item.pctAdministracion),
            vigenciaDesde: new Date(item.vigenciaDesde),
            vigenciaHasta: toDate(item.vigenciaHasta),
            proximoReajuste: toDate(item.proximoReajuste)
          }))
        });
      }

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
