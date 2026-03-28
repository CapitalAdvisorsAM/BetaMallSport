import { Prisma } from "@prisma/client";
import { z } from "zod";

function toDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function ggccKey(vigenciaDesde: Date | string): string {
  return toDateOnly(vigenciaDesde) ?? "";
}

export const dateStringSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Fecha invalida.");

export const nullableDateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Fecha invalida.")
  .nullable();

export const decimalStringSchema = z
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

export const contractPayloadSchema = z
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
