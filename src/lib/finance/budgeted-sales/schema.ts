import { Prisma } from "@prisma/client";
import { z } from "zod";

export const decimalStringSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      // eslint-disable-next-line no-new
      new Prisma.Decimal(value);
      return true;
    } catch {
      return false;
    }
  }, "Numero decimal invalido.");

export const periodSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Periodo invalido. Formato esperado YYYY-MM.");

export const budgetedSaleCellSchema = z
  .object({
    projectId: z.string().min(1),
    tenantId: z.string().min(1),
    period: periodSchema,
    salesPesos: decimalStringSchema.nullable(),
  })
  .superRefine((payload, ctx) => {
    if (payload.salesPesos === null) return;
    try {
      const decimal = new Prisma.Decimal(payload.salesPesos);
      if (decimal.isNegative()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "salesPesos no puede ser negativo.",
          path: ["salesPesos"],
        });
      }
    } catch {
      // decimalStringSchema already flagged this
    }
  });

export type BudgetedSaleCellPayload = (typeof budgetedSaleCellSchema)["_type"];
