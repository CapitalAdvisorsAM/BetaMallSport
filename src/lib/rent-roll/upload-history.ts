import type { Prisma } from "@prisma/client";
import { TipoCargaDatos } from "@prisma/client";
import { parseRentRollPreviewPayload } from "@/lib/carga-datos";
import { prisma } from "@/lib/prisma";
import { parseStoredUploadPayload } from "@/lib/upload/payload";

export type UploadHistoryItem = {
  id: string;
  createdAt: Date;
  archivoNombre: string;
  estado: string;
  created: number;
  updated: number;
  rejected: number;
};

function extractHistoryCounts(errorDetalle: Prisma.JsonValue | null): {
  created: number;
  updated: number;
  rejected: number;
} {
  const modernPayload = parseStoredUploadPayload(errorDetalle);
  if (modernPayload?.report) {
    return {
      created: modernPayload.report.created,
      updated: modernPayload.report.updated,
      rejected: modernPayload.report.rejected
    };
  }
  if (modernPayload) {
    return {
      created: 0,
      updated: 0,
      rejected: modernPayload.summary.errores
    };
  }

  const legacyPayload = parseRentRollPreviewPayload(errorDetalle);
  if (legacyPayload?.report) {
    return {
      created: legacyPayload.report.created,
      updated: legacyPayload.report.updated,
      rejected: legacyPayload.report.rejected
    };
  }
  if (legacyPayload) {
    return {
      created: 0,
      updated: 0,
      rejected: legacyPayload.summary.errorRows
    };
  }

  return { created: 0, updated: 0, rejected: 0 };
}

function mapHistory(
  cargas: Array<{
    id: string;
    createdAt: Date;
    archivoNombre: string;
    estado: string;
    errorDetalle: Prisma.JsonValue | null;
  }>
): UploadHistoryItem[] {
  return cargas.map((carga) => {
    const counts = extractHistoryCounts(carga.errorDetalle);
    return {
      id: carga.id,
      createdAt: carga.createdAt,
      archivoNombre: carga.archivoNombre,
      estado: carga.estado,
      created: counts.created,
      updated: counts.updated,
      rejected: counts.rejected
    };
  });
}

export async function getUploadHistory(
  proyectoId: string,
  tipo: TipoCargaDatos
): Promise<UploadHistoryItem[]> {
  const cargasRaw = await prisma.cargaDatos.findMany({
    where: { proyectoId, tipo },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      archivoNombre: true,
      estado: true,
      errorDetalle: true
    }
  });

  return mapHistory(cargasRaw);
}
