import { z } from "zod";
import { LINE_KEY_REGEX } from "./line-keys";

const lineKeySchema = z
  .string()
  .min(1, "lineKey es obligatorio.")
  .max(200, "lineKey demasiado largo.")
  .regex(LINE_KEY_REGEX, "lineKey inválido.");

const viewSchema = z.enum(["EERR", "CDG"]);
const statusSchema = z.enum(["OPEN", "RESOLVED"]);

export const noteCreateSchema = z.object({
  projectId: z.string().uuid("projectId inválido."),
  lineKey: lineKeySchema,
  view: viewSchema,
  body: z
    .string()
    .trim()
    .min(1, "El cuerpo es obligatorio.")
    .max(5000, "El cuerpo excede el máximo de 5000 caracteres.")
});

export const noteUpdateSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, "El cuerpo es obligatorio.")
      .max(5000, "El cuerpo excede el máximo de 5000 caracteres.")
      .optional(),
    status: statusSchema.optional()
  })
  .refine((data) => data.body !== undefined || data.status !== undefined, {
    message: "Se requiere body o status."
  });

export const noteListQuerySchema = z.object({
  projectId: z.string().uuid("projectId inválido."),
  view: viewSchema.optional(),
  lineKey: lineKeySchema.optional(),
  status: statusSchema.optional()
});

export type NoteCreatePayload = (typeof noteCreateSchema)["_type"];
export type NoteUpdatePayload = (typeof noteUpdateSchema)["_type"];
export type NoteListQuery = (typeof noteListQuerySchema)["_type"];
