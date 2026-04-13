import { MasterStatus, Prisma, UnitType } from "@prisma/client";
import { z } from "zod";

function normalizeGlam2(value: string): string {
  return value.trim().replace(",", ".");
}

function isDecimalValue(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new Prisma.Decimal(value);
    return true;
  } catch {
    return false;
  }
}

function isNonNegativeDecimal(value: string): boolean {
  try {
    return new Prisma.Decimal(value).greaterThanOrEqualTo(0);
  } catch {
    return false;
  }
}

export const unitSchema = z.object({
  proyectoId: z.string().min(1),
  codigo: z.string().trim().min(1, "Codigo es obligatorio.").transform((value) => value.toUpperCase()),
  nombre: z.string().trim().default(""),
  glam2: z
    .string()
    .optional()
    .transform((value) => normalizeGlam2(value ?? ""))
    .refine((value) => value === "" || isDecimalValue(value), "GLA m2 debe ser numerico.")
    .refine(
      (value) => value === "" || isNonNegativeDecimal(value),
      "GLA m2 debe ser mayor o igual a 0."
    )
    .transform((value) => (value === "" ? "0" : value)),
  piso: z.string().trim().min(1, "Piso es obligatorio."),
  tipo: z.nativeEnum(UnitType),
  zonaId: z.string().uuid().nullable(),
  esGLA: z.boolean(),
  estado: z.nativeEnum(MasterStatus)
});
