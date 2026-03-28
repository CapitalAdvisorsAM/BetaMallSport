import type { Prisma } from "@prisma/client";
import type { ApplyReport, PreviewRow, RowStatus, UploadPreview } from "@/types/upload";

type UploadRecord = Record<string, unknown>;

type StoredUploadPayload = UploadPreview<UploadRecord> & {
  report?: ApplyReport;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRowStatus(value: unknown): value is RowStatus {
  return value === "NEW" || value === "UPDATED" || value === "UNCHANGED" || value === "ERROR";
}

function isPreviewRow(value: unknown): value is PreviewRow<UploadRecord> {
  if (!isObject(value)) {
    return false;
  }
  if (typeof value.rowNumber !== "number" || !isRowStatus(value.status) || !isObject(value.data)) {
    return false;
  }
  if (value.changedFields !== undefined) {
    if (!Array.isArray(value.changedFields) || !value.changedFields.every((item) => typeof item === "string")) {
      return false;
    }
  }
  if (value.errorMessage !== undefined && typeof value.errorMessage !== "string") {
    return false;
  }
  return true;
}

function isUploadIssueArray(value: unknown): value is ApplyReport["rejectedRows"] {
  return (
    Array.isArray(value) &&
    value.every((item) => isObject(item) && typeof item.rowNumber === "number" && typeof item.message === "string")
  );
}

function isApplyReport(value: unknown): value is ApplyReport {
  return (
    isObject(value) &&
    typeof value.created === "number" &&
    typeof value.updated === "number" &&
    typeof value.skipped === "number" &&
    typeof value.rejected === "number" &&
    isUploadIssueArray(value.rejectedRows)
  );
}

function isUploadPreview(value: unknown): value is UploadPreview<UploadRecord> {
  return (
    isObject(value) &&
    Array.isArray(value.rows) &&
    value.rows.every(isPreviewRow) &&
    isObject(value.summary) &&
    typeof value.summary.total === "number" &&
    typeof value.summary.nuevo === "number" &&
    typeof value.summary.actualizado === "number" &&
    typeof value.summary.sinCambio === "number" &&
    typeof value.summary.errores === "number" &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string")
  );
}

function parseJsonValue(value: Prisma.JsonValue | null | undefined): unknown {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

export function parseStoredUploadPayload(value: Prisma.JsonValue | null | undefined): StoredUploadPayload | null {
  const parsed = parseJsonValue(value);
  if (!isUploadPreview(parsed)) {
    return null;
  }
  const maybeReport = (parsed as Record<string, unknown>).report;
  if (maybeReport !== undefined && !isApplyReport(maybeReport)) {
    return null;
  }
  return parsed as StoredUploadPayload;
}
