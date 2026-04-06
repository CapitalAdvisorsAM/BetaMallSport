import { DataUploadType } from "@prisma/client";
import { getUploadHistory as getSharedUploadHistory, type UploadHistoryItem } from "@/lib/upload/history";

export async function getUploadHistory(
  proyectoId: string,
  tipo: DataUploadType
): Promise<UploadHistoryItem[]> {
  return getSharedUploadHistory(proyectoId, tipo);
}

