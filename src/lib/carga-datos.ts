import type { Prisma } from "@prisma/client";
import type { RentRollPreviewPayload } from "@/types";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUploadIssueArray(value: unknown): value is RentRollPreviewPayload["errors"] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isObjectRecord(item) && typeof item.rowNumber === "number" && typeof item.message === "string"
    )
  );
}

function isUploadRowArray(value: unknown): value is RentRollPreviewPayload["rows"] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isObjectRecord(item) &&
        typeof item.rowNumber === "number" &&
        typeof item.numeroContrato === "string" &&
        typeof item.localCodigo === "string" &&
        typeof item.arrendatarioRut === "string" &&
        typeof item.estado === "string" &&
        typeof item.fechaInicio === "string" &&
        typeof item.fechaTermino === "string" &&
        typeof item.tarifaTipo === "string" &&
        typeof item.tarifaValor === "string" &&
        typeof item.tarifaVigenciaDesde === "string" &&
        (item.tarifaVigenciaHasta === null || typeof item.tarifaVigenciaHasta === "string") &&
        (item.pctFondoPromocion === null || typeof item.pctFondoPromocion === "string") &&
        (item.codigoCC === null || typeof item.codigoCC === "string") &&
        (item.notas === null || typeof item.notas === "string") &&
        (item.ggccTarifaBaseUfM2 === null || typeof item.ggccTarifaBaseUfM2 === "string") &&
        (item.ggccPctAdministracion === null || typeof item.ggccPctAdministracion === "string") &&
        (item.ggccVigenciaDesde === null || typeof item.ggccVigenciaDesde === "string") &&
        (item.ggccVigenciaHasta === null || typeof item.ggccVigenciaHasta === "string") &&
        (item.anexoFecha === null || typeof item.anexoFecha === "string") &&
        (item.anexoDescripcion === null || typeof item.anexoDescripcion === "string")
    )
  );
}

function isRentRollPreviewPayload(value: unknown): value is RentRollPreviewPayload {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!isUploadRowArray(value.rows)) {
    return false;
  }
  if (!isUploadIssueArray(value.errors)) {
    return false;
  }
  if (!Array.isArray(value.warnings) || !value.warnings.every((item) => typeof item === "string")) {
    return false;
  }
  if (
    !isObjectRecord(value.summary) ||
    typeof value.summary.totalRows !== "number" ||
    typeof value.summary.validRows !== "number" ||
    typeof value.summary.errorRows !== "number"
  ) {
    return false;
  }

  if (value.report !== undefined) {
    if (
      !isObjectRecord(value.report) ||
      typeof value.report.created !== "number" ||
      typeof value.report.updated !== "number" ||
      typeof value.report.rejected !== "number" ||
      !isUploadIssueArray(value.report.rejectedRows)
    ) {
      return false;
    }
  }

  return true;
}

export function parseRentRollPreviewPayload(
  value: Prisma.JsonValue | null | undefined
): RentRollPreviewPayload | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRentRollPreviewPayload(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return isRentRollPreviewPayload(value) ? value : null;
  }

  return null;
}
