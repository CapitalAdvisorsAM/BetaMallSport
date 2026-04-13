import { DataUploadType, ContractRateType } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { parseRentRollPreviewPayload } from "@/lib/upload/data-payload";
import { invalidateMetricsCacheByProject } from "@/lib/metrics-cache";
import { prisma } from "@/lib/prisma";
import {
  applyContrato,
  applyGGCC,
  applyTarifas,
  hasValidPositiveDecimal,
  normalizeContratoRow,
  type ArrendatarioMap,
  type LocalMap,
  type StoredContratoPreview
} from "@/lib/rent-roll/contracts-apply-service";
import { normalizeUploadTenantName } from "@/lib/upload/parse-contracts";
import { parseStoredUploadPayload } from "@/lib/upload/payload";
import type { ApplyReport, PreviewRow, UploadIssue } from "@/types/upload";

export async function runContratosApplyJob(input: {
  cargaId: string;
  userId: string;
}): Promise<{ cargaId: string; projectId: string; report: ApplyReport }> {
  const { cargaId, userId } = input;
  let processingCargaId: string | null = null;

  try {
    const carga = await prisma.dataUpload.findUnique({ where: { id: cargaId } });
    if (!carga || carga.type !== DataUploadType.RENT_ROLL || !carga.errorDetail) {
      throw new ApiError(404, "No existe preview para esta carga.");
    }
    if (carga.status === "PROCESSING") {
      throw new ApiError(409, "La carga ya esta siendo procesada.");
    }

    const modernPayload = parseStoredUploadPayload(carga.errorDetail);
    const payload: StoredContratoPreview | null = modernPayload
      ? modernPayload
      : (() => {
          const legacyPayload = parseRentRollPreviewPayload(carga.errorDetail);
          if (!legacyPayload) {
            return null;
          }
          const modernRows: PreviewRow<Record<string, unknown>>[] = [
            ...legacyPayload.rows.map((row) => ({
              rowNumber: row.rowNumber,
              status: "UPDATED" as const,
              data: row as unknown as Record<string, unknown>
            })),
            ...legacyPayload.errors.map((issue) => ({
              rowNumber: issue.rowNumber,
              status: "ERROR" as const,
              data: {},
              errorMessage: issue.message
            }))
          ];
          return {
            rows: modernRows,
            summary: {
              total: modernRows.length,
              nuevo: 0,
              actualizado: legacyPayload.rows.length,
              sinCambio: 0,
              errores: legacyPayload.errors.length
            },
            warnings: legacyPayload.warnings
          };
        })();

    if (!payload) {
      throw new ApiError(422, "No fue posible leer el preview para esta carga.");
    }

    await prisma.dataUpload.update({
      where: { id: carga.id },
      data: { status: "PROCESSING", userId: userId }
    });
    processingCargaId = carga.id;

    const [locales, arrendatarios] = await Promise.all([
      prisma.unit.findMany({
        where: { proyectoId: carga.projectId },
        select: { id: true, codigo: true, glam2: true }
      }),
      prisma.tenant.findMany({
        where: { proyectoId: carga.projectId },
        select: { id: true, nombreComercial: true }
      })
    ]);

    const localesMap: LocalMap = new Map(
      locales.map((item) => [item.codigo.toUpperCase(), { id: item.id, glam2: item.glam2.toString() }])
    );
    const arrendatariosMap: ArrendatarioMap = new Map<string, string[]>();
    for (const item of arrendatarios) {
      const normalizedName = normalizeUploadTenantName(item.nombreComercial);
      if (!normalizedName) {
        continue;
      }
      const existing = arrendatariosMap.get(normalizedName) ?? [];
      existing.push(item.id);
      arrendatariosMap.set(normalizedName, existing);
    }

    const duplicatedTarifaKey = new Set<string>();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const rejectedRows: UploadIssue[] = [];

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

          const normalized = normalizeContratoRow(row.rowNumber, row.data);
          if (!normalized) {
            rejectedRows.push({
              rowNumber: row.rowNumber,
              message: "No se pudo normalizar la fila para aplicar."
            });
            continue;
          }

          const localData = localesMap.get(normalized.localCodigo.toUpperCase());
          if (normalized.ggccTipo === "FIJO_UF" && !hasValidPositiveDecimal(localData?.glam2 ?? null)) {
            rejectedRows.push({
              rowNumber: normalized.rowNumber,
              message: `El local '${normalized.localCodigo}' no tiene GLA valida para convertir GGCC FIJO_UF a UF/m2.`
            });
            continue;
          }

          const contratoResult = await applyContrato(
            tx,
            normalized,
            carga.projectId,
            localesMap,
            arrendatariosMap
          );

          if (contratoResult.issue) {
            rejectedRows.push(contratoResult.issue);
            continue;
          }

          const { before, contrato } = contratoResult;

          if (before) {
            updated += 1;
          } else {
            created += 1;
          }

          const tarifaKey = `${contrato.id}-${normalized.tarifaTipo}-${normalized.tarifaVigenciaDesde}`;
          if (duplicatedTarifaKey.has(tarifaKey)) {
            rejectedRows.push({
              rowNumber: normalized.rowNumber,
              message: "Tarifa duplicada en el archivo para type + vigenciaDesde."
            });
            continue;
          }
          duplicatedTarifaKey.add(tarifaKey);

          await applyTarifas(tx, contrato.id, normalized);

          if (normalized.rentaVariablePct && Number.isFinite(Number(normalized.rentaVariablePct))) {
            await applyTarifas(tx, contrato.id, {
              tarifaTipo: ContractRateType.PORCENTAJE,
              tarifaValor: normalized.rentaVariablePct,
              tarifaVigenciaDesde: normalized.fechaInicio,
              tarifaVigenciaHasta: normalized.fechaTermino
            });
          }

          const tramosEscalonados = [
            { valor: normalized.tarifa2Valor, desde: normalized.tarifa2VigenciaDesde, hasta: normalized.tarifa2VigenciaHasta },
            { valor: normalized.tarifa3Valor, desde: normalized.tarifa3VigenciaDesde, hasta: normalized.tarifa3VigenciaHasta },
            { valor: normalized.tarifa4Valor, desde: normalized.tarifa4VigenciaDesde, hasta: normalized.tarifa4VigenciaHasta },
            { valor: normalized.tarifa5Valor, desde: normalized.tarifa5VigenciaDesde, hasta: normalized.tarifa5VigenciaHasta }
          ];
          for (const tramo of tramosEscalonados) {
            if (tramo.valor && tramo.desde && Number.isFinite(Number(tramo.valor))) {
              await applyTarifas(tx, contrato.id, {
                tarifaTipo: normalized.tarifaTipo,
                tarifaValor: tramo.valor,
                tarifaVigenciaDesde: tramo.desde,
                tarifaVigenciaHasta: tramo.hasta
              });
            }
          }

          if (localData) {
            await applyGGCC(tx, contrato.id, normalized, localData.glam2, normalized.fechaInicio, normalized.fechaTermino);
          }

          if (normalized.anexoFecha && normalized.anexoDescripcion) {
            await tx.contractAmendment.create({
              data: {
                contratoId: contrato.id,
                fecha: new Date(normalized.anexoFecha),
                descripcion: normalized.anexoDescripcion,
                camposModificados: {
                  origen: "CARGA_RENT_ROLL",
                  rowNumber: normalized.rowNumber
                },
                snapshotAntes: before ? before : {},
                snapshotDespues: contrato,
                usuarioId: userId
              }
            });
          }
        }
      },
      { timeout: 60000, maxWait: 10000 }
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

    await prisma.dataUpload.update({
      where: { id: carga.id },
      data: {
        status: created + updated > 0 ? "OK" : "ERROR",
        recordsLoaded: created + updated,
        errorDetail: JSON.stringify(finalPayload)
      }
    });
    invalidateMetricsCacheByProject(carga.projectId);

    return { cargaId: carga.id, projectId: carga.projectId, report };
  } catch (error) {
    if (processingCargaId) {
      await prisma.dataUpload
        .update({
          where: { id: processingCargaId },
          data: { status: "ERROR" }
        })
        .catch(() => undefined);
    }
    throw error;
  }
}

