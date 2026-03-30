import { EstadoMaestro, Prisma, TipoLocal } from "@prisma/client";
import { z } from "zod";

export const localeSchema = z.object({
  proyectoId: z.string().min(1),
  codigo: z.string().trim().min(1, "Codigo es obligatorio."),
  nombre: z.string().trim().default(""),
  glam2: z
    .string()
    .trim()
    .min(1)
    .refine((value) => {
      try {
        // eslint-disable-next-line no-new
        new Prisma.Decimal(value);
        return true;
      } catch {
        return false;
      }
    }, "GLA m2 debe ser numerico."),
  piso: z.string().trim().min(1, "Piso es obligatorio."),
  tipo: z.nativeEnum(TipoLocal),
  zona: z.string().trim().nullable(),
  esGLA: z.boolean(),
  estado: z.nativeEnum(EstadoMaestro)
});
