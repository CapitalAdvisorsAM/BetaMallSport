import { TipoCargaDatos } from "@prisma/client";
import { getUploadHistory as getSharedUploadHistory, type UploadHistoryItem } from "@/lib/upload/history";

export async function getUploadHistory(
  proyectoId: string,
  tipo: TipoCargaDatos
): Promise<UploadHistoryItem[]> {
  return getSharedUploadHistory(proyectoId, tipo);
}
