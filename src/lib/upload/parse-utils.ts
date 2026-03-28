const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const MAX_ROWS = 2000;

export const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 3000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function toIsoDate(year: number, month: number, day: number): string {
  const safeYear = String(year).padStart(4, "0");
  const safeMonth = String(month).padStart(2, "0");
  const safeDay = String(day).padStart(2, "0");
  return `${safeYear}-${safeMonth}-${safeDay}`;
}

function fromDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  if (!isValidDateParts(year, month, day)) {
    return null;
  }
  return toIsoDate(year, month, day);
}

function parseDateFromExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) {
    return null;
  }
  const epoch = Date.UTC(1899, 11, 30);
  const millis = Math.round(serial * 86400000);
  return fromDate(new Date(epoch + millis));
}

export function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (raw instanceof Date) {
    return fromDate(raw);
  }

  if (typeof raw === "number") {
    return parseDateFromExcelSerial(raw);
  }

  const text = String(raw).trim();
  if (!text) {
    return null;
  }

  const ddmmyyyy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
  const yyyymmdd = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/;

  let parts: [number, number, number] | null = null;
  if (ddmmyyyy.test(text)) {
    const match = text.match(ddmmyyyy);
    if (match) {
      parts = [Number(match[3]), Number(match[2]), Number(match[1])];
    }
  } else if (yyyymmdd.test(text)) {
    const match = text.match(yyyymmdd);
    if (match) {
      parts = [Number(match[1]), Number(match[2]), Number(match[3])];
    }
  }

  if (parts) {
    const [year, month, day] = parts;
    if (!isValidDateParts(year, month, day)) {
      return null;
    }
    return toIsoDate(year, month, day);
  }

  return fromDate(new Date(text));
}

export function normalizeHeaders(row: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(row).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    const normalizedKey = key.replace(/^\uFEFF/, "").trim().toLowerCase();
    if (!normalizedKey) {
      return accumulator;
    }
    accumulator[normalizedKey] = value;
    return accumulator;
  }, {});
}

export function validateFileGuards(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "El archivo supera el limite de 5MB.";
  }

  const mimeType = file.type.trim().toLowerCase();
  const hasValidExtension = /\.(csv|xlsx|xls)$/i.test(file.name);
  const hasValidMime = mimeType.length === 0 || ALLOWED_MIME_TYPES.includes(mimeType);

  if (!hasValidExtension) {
    return "Extension no soportada. Usa CSV o Excel (.xlsx/.xls).";
  }
  if (!hasValidMime) {
    return "Tipo MIME no soportado para archivo de carga.";
  }

  return null;
}
