import { z } from "zod";
import { PERIODO_FIELD_CATALOG } from "./custom-widget-engine";

const VALID_FIELDS = Object.keys(PERIODO_FIELD_CATALOG) as [string, ...string[]];
const VALID_FORMATS = ["number", "uf", "percent", "m2", "months"] as const;

const singleFormulaSchema = z.object({
  type: z.literal("single"),
  field: z.enum(VALID_FIELDS),
  format: z.enum(VALID_FORMATS),
});

const binaryFormulaSchema = z.object({
  type: z.literal("binary"),
  fieldA: z.enum(VALID_FIELDS),
  operator: z.enum(["+", "-", "*", "/"]),
  fieldB: z.enum(VALID_FIELDS),
  format: z.enum(VALID_FORMATS),
});

const formulaConfigSchema = z.discriminatedUnion("type", [singleFormulaSchema, binaryFormulaSchema]);

export const createCustomWidgetSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio.").max(100),
  chartType: z.enum(["line", "bar", "area", "kpi"]).default("line"),
  enabled: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
  formulaConfig: formulaConfigSchema,
});

export const updateCustomWidgetSchema = createCustomWidgetSchema.partial().extend({
  formulaConfig: formulaConfigSchema.optional(),
});

export type CreateCustomWidgetPayload = z.infer<typeof createCustomWidgetSchema>;
export type UpdateCustomWidgetPayload = z.infer<typeof updateCustomWidgetSchema>;
