export const dynamic = "force-dynamic";

import { TipoCargaDatos } from "@prisma/client";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { resolveTenantRut } from "@/lib/arrendatarios/schema";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeUploadRut } from "@/lib/upload/parse-arrendatarios";
import { parseStoredUploadPayload } from "@/lib/upload/payload";
import type { ApplyReport } from "@/types/upload";

export const runtime = "nodejs";

type NormalizedArrendatarioRow = {
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  vigente: boolean;
  email: string | null;
  telefono: string | null;
};

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function normalizeNullable(value: unknown): string | null {
  const parsed = asString(value);
  return parsed ? parsed : null;
}

function normalizeArrendatarioData(data: Record<string, unknown>): NormalizedArrendatarioRow | null {
  const rutInput = normalizeUploadRut(asString(data.rut));
  const razonSocial = asString(data.razonSocial);
  const nombreComercial = asString(data.nombreComercial);
  const vigente = Boolean(data.vigente);
  const email = normalizeNullable(data.email);
  const telefono = normalizeNullable(data.telefono);

  if (!razonSocial || !nombreComercial) {
    return null;
  }
  if (rutInput && !/^\d{7,8}-[\dk]$/.test(rutInput)) {
    return null;
  }

  const rut = resolveTenantRut(rutInput, razonSocial, nombreComercial);

  return {
    rut,
    razonSocial,
    nombreComercial,
    vigente,
    email,
    telefono
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let processingCargaId: string | null = null;
  try {
    const session = await requireWriteAccess();
    const body = (await request.json()) as { cargaId?: string };
    const cargaId = body.cargaId ?? "";

    if (!cargaId) {
      return NextResponse.json({ message: "cargaId es obligatorio." }, { status: 400 });
    }

    const carga = await prisma.cargaDatos.findUnique({ where: { id: cargaId } });
    if (!carga || carga.tipo !== TipoCargaDatos.ARRENDATARIOS) {
      return NextResponse.json({ message: "No existe preview para esta carga." }, { status: 404 });
    }
    if (carga.estado === "PROCESANDO") {
      return NextResponse.json({ message: "La carga ya esta siendo procesada." }, { status: 409 });
    }

    const payload = parseStoredUploadPayload(carga.errorDetalle);
    if (!payload) {
      return NextResponse.json({ message: "No fue posible leer el preview para esta carga." }, { status: 422 });
    }

    const arrendatariosConContratosVigentes = await prisma.tenant.findMany({
      where: {
        proyectoId: carga.proyectoId,
        contratos: {
          some: { estado: "VIGENTE" }
        }
      },
      select: { rut: true }
    });
    const activeContractRuts = new Set(
      arrendatariosConContratosVigentes.map((arrendatario) => normalizeUploadRut(arrendatario.rut))
    );

    await prisma.cargaDatos.update({
      where: { id: carga.id },
      data: { estado: "PROCESANDO", usuarioId: session.user.id }
    });
    processingCargaId = carga.id;

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const rejectedRows: ApplyReport["rejectedRows"] = [];

    await prisma.$transaction(
      async (tx) => {
        for (const row of payload.rows) {
          if (row.status === "ERROR") {
            rejectedRows.push({
              rowNumber: row.rowNumber,
              message: row.errorMessage ?? "Fila invalida en preview."
            });
            continue;
          }

          if (row.status === "UNCHANGED") {
            skipped += 1;
            continue;
          }

          const normalized = normalizeArrendatarioData(row.data);
          if (!normalized) {
            rejectedRows.push({
              rowNumber: row.rowNumber,
              message: "No se pudo normalizar la fila para aplicar."
            });
            continue;
          }

          // Proteger contra desactivación de arrendatarios con contratos vigentes.
          // activeContractRuts fue calculado antes de la transacción con datos frescos.
          if (!normalized.vigente && activeContractRuts.has(normalized.rut)) {
            skipped += 1;
            continue;
          }

          await tx.tenant.upsert({
            where: {
              proyectoId_rut: {
                proyectoId: carga.proyectoId,
                rut: normalized.rut
              }
            },
            create: {
              proyectoId: carga.proyectoId,
              rut: normalized.rut,
              razonSocial: normalized.razonSocial,
              nombreComercial: normalized.nombreComercial,
              vigente: normalized.vigente,
              email: normalized.email,
              telefono: normalized.telefono
            },
            update: {
              razonSocial: normalized.razonSocial,
              nombreComercial: normalized.nombreComercial,
              vigente: normalized.vigente,
              email: normalized.email,
              telefono: normalized.telefono
            }
          });

          // row.status ya codifica si existía o no — calculado en el preview.
          if (row.status === "UPDATED") {
            updated += 1;
          } else {
            created += 1;
          }
        }
      },
      { timeout: 30000 }
    );

    const report: ApplyReport = {
      created,
      updated,
      skipped,
      rejected: rejectedRows.length,
      rejectedRows
    };
    const finalPayload = {
      ...payload,
      report
    };

    await prisma.cargaDatos.update({
      where: { id: carga.id },
      data: {
        estado: created + updated > 0 ? "OK" : "ERROR",
        registrosCargados: created + updated,
        errorDetalle: JSON.stringify(finalPayload)
      }
    });
    invalidateMetricsCacheByProject(carga.proyectoId);

    return NextResponse.json({ cargaId: carga.id, report });
  } catch (error) {
    if (processingCargaId) {
      await prisma.cargaDatos
        .update({
          where: { id: processingCargaId },
          data: { estado: "ERROR" }
        })
        .catch(() => undefined);
    }
    return handleApiError(error);
  }
}
