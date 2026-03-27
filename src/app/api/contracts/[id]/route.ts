import { Prisma, TipoTarifaContrato } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const dateStringSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Fecha invalida.");

const nullableDateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Fecha invalida.")
  .nullable();

const decimalStringSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      // Decimal constructor throws when input is invalid.
      // eslint-disable-next-line no-new
      new Prisma.Decimal(value);
      return true;
    } catch {
      return false;
    }
  }, "Numero decimal invalido.");

const contractPayloadSchema = z
  .object({
    proyectoId: z.string().min(1),
    localId: z.string().min(1),
    arrendatarioId: z.string().min(1),
    numeroContrato: z.string().min(1),
    fechaInicio: dateStringSchema,
    fechaTermino: dateStringSchema,
    fechaEntrega: nullableDateStringSchema,
    fechaApertura: nullableDateStringSchema,
    estado: z.enum(["VIGENTE", "TERMINADO", "TERMINADO_ANTICIPADO", "GRACIA"]),
    pctRentaVariable: decimalStringSchema.nullable(),
    pctFondoPromocion: decimalStringSchema.nullable(),
    codigoCC: z.string().nullable(),
    pdfUrl: z.string().nullable(),
    notas: z.string().nullable(),
    tarifas: z.array(
      z.object({
        tipo: z.enum(["FIJO_UF_M2", "FIJO_UF", "PORCENTAJE"]),
        valor: decimalStringSchema,
        vigenciaDesde: dateStringSchema,
        vigenciaHasta: nullableDateStringSchema,
        esDiciembre: z.boolean()
      })
    ),
    ggcc: z.array(
      z.object({
        tarifaBaseUfM2: decimalStringSchema,
        pctAdministracion: decimalStringSchema,
        vigenciaDesde: dateStringSchema,
        vigenciaHasta: nullableDateStringSchema,
        proximoReajuste: nullableDateStringSchema
      })
    ),
    anexo: z
      .object({
        fecha: dateStringSchema,
        descripcion: z.string().min(1)
      })
      .nullable()
  })
  .superRefine((payload, ctx) => {
    if (new Date(payload.fechaInicio) > new Date(payload.fechaTermino)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fechaInicio no puede ser mayor que fechaTermino.",
        path: ["fechaInicio"]
      });
    }

    const keys = new Set<string>();
    for (const tarifa of payload.tarifas) {
      const key = `${tarifa.tipo}|${toDateOnly(tarifa.vigenciaDesde)}`;
      if (keys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hay tarifas duplicadas con mismo tipo + vigenciaDesde.",
          path: ["tarifas"]
        });
        break;
      }
      keys.add(key);
    }

    const ggccKeys = new Set<string>();
    for (const item of payload.ggcc) {
      const key = ggccKey(item.vigenciaDesde);
      if (ggccKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hay GGCC duplicados con mismo vigenciaDesde.",
          path: ["ggcc"]
        });
        break;
      }
      ggccKeys.add(key);
    }
  });

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
  payload: z.infer<typeof contractPayloadSchema>
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
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json({ message: "No autorizado." }, { status: 403 });
    }
    return NextResponse.json({ message: "No fue posible actualizar el contrato." }, { status: 500 });
  }
}
