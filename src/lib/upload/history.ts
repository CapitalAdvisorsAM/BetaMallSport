import type { Prisma, DataUploadType } from "@prisma/client";
import { parseRentRollPreviewPayload } from "@/lib/upload/data-payload";
import { prisma } from "@/lib/prisma";
import { parseStoredUploadPayload } from "@/lib/upload/payload";

export type UploadHistoryItem = {
  id: string;
  createdAt: Date;
  fileName: string;
  status: string;
  created: number;
  updated: number;
  rejected: number;
};

type HistoryFallbackMode = "created" | "updated";

function extractHistoryCounts(
  errorDetail: Prisma.JsonValue | null,
  recordsLoaded: number,
  fallbackMode: HistoryFallbackMode
): {
  created: number;
  updated: number;
  rejected: number;
} {
  const modernPayload = parseStoredUploadPayload(errorDetail);
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

  const legacyPayload = parseRentRollPreviewPayload(errorDetail);
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

  return fallbackMode === "created"
    ? { created: recordsLoaded, updated: 0, rejected: 0 }
    : { created: 0, updated: recordsLoaded, rejected: 0 };
}

export function mapUploadHistory(
  cargas: Array<{
    id: string;
    createdAt: Date;
    fileName: string;
    status: string;
    recordsLoaded: number;
    errorDetail: Prisma.JsonValue | null;
  }>,
  fallbackMode: HistoryFallbackMode = "created"
): UploadHistoryItem[] {
  return cargas.map((carga) => {
    const counts = extractHistoryCounts(carga.errorDetail, carga.recordsLoaded, fallbackMode);
    return {
      id: carga.id,
      createdAt: carga.createdAt,
      fileName: carga.fileName,
      status: carga.status,
      created: counts.created,
      updated: counts.updated,
      rejected: counts.rejected
    };
  });
}

export async function getUploadHistory(
  projectId: string,
  type: DataUploadType,
  fallbackMode: HistoryFallbackMode = "created"
): Promise<UploadHistoryItem[]> {
  const cargas = await prisma.dataUpload.findMany({
    where: { projectId, type },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      createdAt: true,
      fileName: true,
      status: true,
      recordsLoaded: true,
      errorDetail: true
    }
  });

  return mapUploadHistory(cargas, fallbackMode);
}

