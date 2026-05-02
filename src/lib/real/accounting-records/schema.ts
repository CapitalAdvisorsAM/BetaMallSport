import { Prisma } from "@prisma/client";
import { z } from "zod";

const decimalStringSchema = z
  .string()
  .min(1)
  .refine((v) => {
    try {
      new Prisma.Decimal(v); // eslint-disable-line no-new
      return true;
    } catch {
      return false;
    }
  }, "Número decimal inválido.");

export const accountingRecordPatchSchema = z
  .object({
    valueUf: decimalStringSchema.optional(),
    group1: z.string().trim().min(1).optional(),
    group3: z.string().trim().min(1).optional(),
    unitId: z.string().uuid().nullable().optional(),
    tenantId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) =>
      data.valueUf !== undefined ||
      data.group1 !== undefined ||
      data.group3 !== undefined ||
      data.unitId !== undefined ||
      data.tenantId !== undefined,
    { message: "Debe enviar al menos un campo para actualizar." }
  );

export type AccountingRecordPatch = (typeof accountingRecordPatchSchema)["_type"];
