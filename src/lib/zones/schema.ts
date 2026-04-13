import { z } from "zod";

export const zoneSchema = z.object({
  proyectoId: z.string().min(1),
  nombre: z.string().trim().min(1, "Nombre es obligatorio.").max(100, "Nombre no puede superar 100 caracteres.")
});
