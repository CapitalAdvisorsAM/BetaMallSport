import { z } from "zod";

export const accountTypeEnum = z.enum(["INGRESO", "COSTO", "INVERSION", "OTRO"]);

export const chartOfAccountUpdateSchema = z.object({
  type: accountTypeEnum.nullable().optional(),
  alias: z.string().trim().max(120).nullable().optional(),
  displayOrder: z.number().int().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional()
});

export type ChartOfAccountUpdatePayload = z.infer<typeof chartOfAccountUpdateSchema>;
