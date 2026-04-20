import { Prisma } from "@prisma/client";
import { z } from "zod";

function toDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function rentaVariableKey(vigenciaDesde: Date | string): string {
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
    localIds: z.array(z.string().min(1)).default([]),
    arrendatarioId: z.string().min(1),
    numeroContrato: z.string().min(1).optional(),
    fechaInicio: dateStringSchema,
    fechaTermino: dateStringSchema,
    fechaEntrega: nullableDateStringSchema,
    fechaApertura: nullableDateStringSchema,
    diasGracia: z.number().int().min(0).default(0),
    rentaVariable: z
      .array(
        z.object({
          pctRentaVariable: decimalStringSchema,
          umbralVentasUf: decimalStringSchema,
          pisoMinimoUf: decimalStringSchema.nullable().default(null),
          vigenciaDesde: dateStringSchema,
          vigenciaHasta: nullableDateStringSchema
        })
      )
      .default([]),
    pctFondoPromocion: decimalStringSchema.nullable(),
    pctAdministracionGgcc: decimalStringSchema.nullable(),
    multiplicadorDiciembre: decimalStringSchema.nullable(),
    multiplicadorJunio: decimalStringSchema.nullable(),
    multiplicadorJulio: decimalStringSchema.nullable(),
    multiplicadorAgosto: decimalStringSchema.nullable(),
    codigoCC: z.string().nullable(),
    pdfUrl: z.string().nullable(),
    notas: z.string().nullable(),
    tarifas: z.array(
      z.object({
        tipo: z.enum(["FIJO_UF_M2", "FIJO_UF", "PORCENTAJE"]),
        valor: decimalStringSchema,
        vigenciaDesde: dateStringSchema,
        vigenciaHasta: nullableDateStringSchema,
        esDiciembre: z.boolean(),
        descuentoTipo: z.enum(["PORCENTAJE", "MONTO_UF"]).nullable().default(null),
        descuentoValor: decimalStringSchema.nullable().default(null),
        descuentoDesde: nullableDateStringSchema,
        descuentoHasta: nullableDateStringSchema
      })
    ),
    ggcc: z.array(
      z.object({
        tarifaBaseUfM2: decimalStringSchema,
        pctAdministracion: decimalStringSchema,
        pctReajuste: decimalStringSchema.nullable(),
        proximoReajuste: nullableDateStringSchema,
        mesesReajuste: z.number().int().min(1).nullable()
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

    const contractStart = new Date(payload.fechaInicio).getTime();
    const contractEnd = new Date(payload.fechaTermino).getTime();

    for (let i = 0; i < payload.tarifas.length; i += 1) {
      const tarifa = payload.tarifas[i];

      const tarifaDesde = new Date(tarifa.vigenciaDesde).getTime();
      if (tarifaDesde < contractStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "vigenciaDesde de la tarifa no puede ser anterior a fechaInicio del contrato.",
          path: ["tarifas", i, "vigenciaDesde"]
        });
      }
      if (tarifa.vigenciaHasta !== null) {
        const tarifaHasta = new Date(tarifa.vigenciaHasta).getTime();
        if (tarifaHasta > contractEnd) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "vigenciaHasta de la tarifa no puede ser posterior a fechaTermino del contrato.",
            path: ["tarifas", i, "vigenciaHasta"]
          });
        }
      }

      if (tarifa.descuentoTipo !== null) {
        if (tarifa.descuentoValor === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "descuentoValor es obligatorio cuando hay descuentoTipo.",
            path: ["tarifas", i, "descuentoValor"]
          });
          continue;
        }

        if (tarifa.tipo === "PORCENTAJE") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "No se puede aplicar descuento a una tarifa de renta variable (PORCENTAJE).",
            path: ["tarifas", i, "descuentoTipo"]
          });
          continue;
        }

        let descValor: Prisma.Decimal;
        let valorBase: Prisma.Decimal;
        try {
          descValor = new Prisma.Decimal(tarifa.descuentoValor);
          valorBase = new Prisma.Decimal(tarifa.valor);
        } catch {
          continue;
        }

        if (descValor.lessThanOrEqualTo(0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "descuentoValor debe ser positivo.",
            path: ["tarifas", i, "descuentoValor"]
          });
          continue;
        }

        if (tarifa.descuentoTipo === "PORCENTAJE" && descValor.greaterThan(1)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "descuentoValor en PORCENTAJE debe ser <= 1.",
            path: ["tarifas", i, "descuentoValor"]
          });
          continue;
        }

        if (tarifa.descuentoTipo === "MONTO_UF" && descValor.greaterThanOrEqualTo(valorBase)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "descuentoValor en MONTO_UF debe ser menor al valor base de la tarifa.",
            path: ["tarifas", i, "descuentoValor"]
          });
          continue;
        }
      } else if (tarifa.descuentoValor !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "descuentoTipo es obligatorio cuando hay descuentoValor.",
          path: ["tarifas", i, "descuentoTipo"]
        });
        continue;
      }

      if (tarifa.descuentoDesde !== null && tarifa.descuentoHasta !== null) {
        if (new Date(tarifa.descuentoDesde) > new Date(tarifa.descuentoHasta)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "descuentoDesde no puede ser mayor que descuentoHasta.",
            path: ["tarifas", i, "descuentoDesde"]
          });
        }
      }

      if (tarifa.descuentoDesde !== null && new Date(tarifa.descuentoDesde) < new Date(tarifa.vigenciaDesde)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "descuentoDesde debe estar dentro de la vigencia de la tarifa.",
          path: ["tarifas", i, "descuentoDesde"]
        });
      }

      if (
        tarifa.descuentoHasta !== null &&
        tarifa.vigenciaHasta !== null &&
        new Date(tarifa.descuentoHasta) > new Date(tarifa.vigenciaHasta)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "descuentoHasta debe estar dentro de la vigencia de la tarifa.",
          path: ["tarifas", i, "descuentoHasta"]
        });
      }
    }

    for (let i = 0; i < payload.ggcc.length; i += 1) {
      const item = payload.ggcc[i];
      if (item.mesesReajuste !== null && item.pctReajuste === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "pctReajuste es obligatorio cuando GGCC tiene mesesReajuste.",
          path: ["ggcc", i, "pctReajuste"]
        });
      }
      if (item.mesesReajuste !== null && item.proximoReajuste === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "proximoReajuste es obligatorio cuando GGCC tiene mesesReajuste.",
          path: ["ggcc", i, "proximoReajuste"]
        });
      }
    }

    const rentaVariableKeys = new Set<string>();
    for (const item of payload.rentaVariable) {
      const key = `${rentaVariableKey(item.vigenciaDesde)}|${item.umbralVentasUf}`;
      if (rentaVariableKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hay tramos de renta variable duplicados con mismo umbral y vigenciaDesde.",
          path: ["rentaVariable"]
        });
        break;
      }
      rentaVariableKeys.add(key);
    }

    // Overlapping validity windows within the same tarifa group.
    // Fixed rates are grouped by (tipo, esDiciembre); variable tiers are grouped by umbralVentasUf.
    // Two windows [desdeA, hastaA] and [desdeB, hastaB] overlap iff desdeA <= hastaB AND desdeB <= hastaA.
    // A null hasta is treated as +infinity.
    const tarifaGroups = new Map<string, Array<{ desde: number; hasta: number }>>();
    for (const tarifa of payload.tarifas) {
      const groupKey = `${tarifa.tipo}|${tarifa.esDiciembre ? "DEC" : "REG"}`;
      const desde = new Date(tarifa.vigenciaDesde).getTime();
      const hasta = tarifa.vigenciaHasta ? new Date(tarifa.vigenciaHasta).getTime() : Number.POSITIVE_INFINITY;
      const list = tarifaGroups.get(groupKey) ?? [];
      list.push({ desde, hasta });
      tarifaGroups.set(groupKey, list);
    }
    for (const list of tarifaGroups.values()) {
      const sorted = [...list].sort((a, b) => a.desde - b.desde);
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].desde <= sorted[i - 1].hasta) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hay tarifas con vigencias solapadas del mismo tipo.",
            path: ["tarifas"]
          });
          break;
        }
      }
    }

    const rentaVariableGroups = new Map<string, Array<{ desde: number; hasta: number }>>();
    for (const item of payload.rentaVariable) {
      const groupKey = item.umbralVentasUf;
      const desde = new Date(item.vigenciaDesde).getTime();
      const hasta = item.vigenciaHasta ? new Date(item.vigenciaHasta).getTime() : Number.POSITIVE_INFINITY;
      const list = rentaVariableGroups.get(groupKey) ?? [];
      list.push({ desde, hasta });
      rentaVariableGroups.set(groupKey, list);
    }
    for (const list of rentaVariableGroups.values()) {
      const sorted = [...list].sort((a, b) => a.desde - b.desde);
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].desde <= sorted[i - 1].hasta) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hay tramos de renta variable con vigencias solapadas para el mismo umbral.",
            path: ["rentaVariable"]
          });
          break;
        }
      }
    }

    if (payload.rentaVariable.length > 0) {
      const hasBaseTier = payload.rentaVariable.some((item) => {
        try {
          return new Prisma.Decimal(item.umbralVentasUf).isZero();
        } catch {
          return false;
        }
      });
      if (!hasBaseTier) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe existir un tramo base con umbral 0.",
          path: ["rentaVariable"]
        });
      }
    }

    const localIds = payload.localIds.length > 0 ? payload.localIds : [payload.localId];
    const seenLocalIds = new Set<string>();
    for (const localId of localIds) {
      if (seenLocalIds.has(localId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hay locales duplicados en el contrato.",
          path: ["localIds"]
        });
        break;
      }
      seenLocalIds.add(localId);
    }
  });
