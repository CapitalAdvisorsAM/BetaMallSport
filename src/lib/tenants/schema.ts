import { createHash } from "crypto";
import { z } from "zod";

export const tenantSchema = z.object({
  proyectoId: z.string().min(1),
  rut: z.string().trim().nullable().optional(),
  razonSocial: z.string().trim().min(1, "Razon social es obligatoria."),
  nombreComercial: z.string().trim().min(1, "Nombre comercial es obligatorio."),
  vigente: z.boolean(),
  email: z.string().trim().email("Email invalido.").nullable(),
  telefono: z.string().trim().nullable()
});

export function normalizeRut(value: string | null | undefined): string {
  return (value ?? "").replace(/\./g, "").replace(/\s+/g, "").toUpperCase();
}

function buildRutFallback(razonSocial: string, nombreComercial: string): string {
  const seed = `${razonSocial.trim().toUpperCase()}|${nombreComercial.trim().toUpperCase()}`;
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 16).toUpperCase();
  return `NO-RUT-${hash}`;
}

export function resolveTenantRut(
  rut: string | null | undefined,
  razonSocial: string,
  nombreComercial: string
): string {
  const normalized = normalizeRut(rut);
  return normalized || buildRutFallback(razonSocial, nombreComercial);
}
