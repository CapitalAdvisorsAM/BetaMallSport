import { z } from "zod";

export const tenantSchema = z.object({
  proyectoId: z.string().min(1),
  rut: z.string().trim().min(1, "RUT es obligatorio."),
  razonSocial: z.string().trim().min(1, "Razon social es obligatoria."),
  nombreComercial: z.string().trim().min(1, "Nombre comercial es obligatorio."),
  vigente: z.boolean(),
  email: z.string().trim().email("Email invalido.").nullable(),
  telefono: z.string().trim().nullable()
});

export function normalizeRut(value: string): string {
  return value.replace(/\./g, "").toUpperCase();
}
