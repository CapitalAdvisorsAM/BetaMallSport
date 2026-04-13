import { read, utils } from "xlsx";
import { MAX_ROWS, normalizeHeaders } from "@/lib/upload/parse-utils";
import type { PreviewRow, UploadPreview } from "@/types/upload";

type RawRow = Record<string, unknown>;

const requiredColumns = ["razonsocial", "nombrecomercial"];
const trueLiterals = new Set(["true", "1", "si", "sí", "yes", "y"]);
const falseLiterals = new Set(["false", "0", "no", "n"]);

export type TenantUploadRow = {
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  vigente: boolean;
  email: string | null;
  telefono: string | null;
};

export type ExistingTenantForDiff = {
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

export function normalizeUploadRut(value: string): string {
  const cleaned = value.replace(/\./g, "").replace(/\s+/g, "").trim();
  const rutMatch = /^(\d{7,8})-([\dkK])$/.exec(cleaned);
  if (rutMatch) {
    return `${rutMatch[1]}-${rutMatch[2].toLowerCase()}`;
  }
  return cleaned.toUpperCase();
}

function isValidRutFormat(value: string): boolean {
  return /^\d{7,8}-[\dk]$/.test(value);
}

function normalizeNamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildNameKey(razonSocial: string, nombreComercial: string): string {
  return `${normalizeNamePart(razonSocial)}|${normalizeNamePart(nombreComercial)}`;
}

export function buildUploadTenantKey(
  rut: string,
  razonSocial: string,
  nombreComercial: string
): string {
  const normalizedRut = normalizeUploadRut(rut);
  if (normalizedRut) {
    return `rut:${normalizedRut}`;
  }
  return `name:${buildNameKey(razonSocial, nombreComercial)}`;
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  const normalized = asString(value).toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  if (trueLiterals.has(normalized)) {
    return true;
  }
  if (falseLiterals.has(normalized)) {
    return false;
  }
  return defaultValue;
}

function emptyRow(): TenantUploadRow {
  return {
    rut: "",
    razonSocial: "",
    nombreComercial: "",
    vigente: true,
    email: null,
    telefono: null
  };
}

function summarize(rows: PreviewRow<TenantUploadRow>[]): UploadPreview<TenantUploadRow>["summary"] {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      if (row.status === "NEW") {
        summary.nuevo += 1;
      } else if (row.status === "UPDATED") {
        summary.actualizado += 1;
      } else if (row.status === "UNCHANGED") {
        summary.sinCambio += 1;
      } else {
        summary.errores += 1;
      }
      return summary;
    },
    {
      total: 0,
      nuevo: 0,
      actualizado: 0,
      sinCambio: 0,
      errores: 0
    }
  );
}

function compareWithExisting(
  row: TenantUploadRow,
  existing: ExistingTenantForDiff
): (keyof TenantUploadRow)[] {
  const changed: (keyof TenantUploadRow)[] = [];
  if (existing.razonSocial.trim() !== row.razonSocial) {
    changed.push("razonSocial");
  }
  if (existing.nombreComercial.trim() !== row.nombreComercial) {
    changed.push("nombreComercial");
  }
  if (existing.vigente !== row.vigente) {
    changed.push("vigente");
  }
  if ((existing.email ?? null) !== row.email) {
    changed.push("email");
  }
  if ((existing.telefono ?? null) !== row.telefono) {
    changed.push("telefono");
  }
  return changed;
}

export function parseTenantsFile(
  buffer: ArrayBuffer,
  existingMap: Map<string, ExistingTenantForDiff>,
  activeContractRuts: Set<string>
): UploadPreview<TenantUploadRow> {
  const workbook = read(Buffer.from(buffer), { type: "buffer", raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    const rows: PreviewRow<TenantUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: "El archivo no contiene hojas."
      }
    ];
    return { rows, summary: summarize(rows), warnings: [] };
  }

  const sourceRows = utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], {
    defval: "",
    raw: false,
    range: 2
  });
  const normalizedRows = sourceRows.map((row) => normalizeHeaders(row));

  if (normalizedRows.length > MAX_ROWS) {
    const rows: PreviewRow<TenantUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: `El archivo supera el maximo de ${MAX_ROWS} filas.`
      }
    ];
    return { rows, summary: summarize(rows), warnings: [] };
  }

  const headers = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    const rows: PreviewRow<TenantUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: `Faltan columnas requeridas: ${missing.join(", ")}`
      }
    ];
    return { rows, summary: summarize(rows), warnings: [] };
  }

  const warnings: string[] = [];

  const previewRows: PreviewRow<TenantUploadRow>[] = normalizedRows.map((rawRow, index) => {
    const rowNumber = index + 2;
    const rutNormalized = normalizeUploadRut(asString(rawRow.rut));
    const razonSocial = asString(rawRow.razonsocial);
    const nombreComercial = asString(rawRow.nombrecomercial);
    const vigente = parseBoolean(rawRow.vigente, true);
    const email = normalizeNullable(rawRow.email);
    const telefono = normalizeNullable(rawRow.telefono);

    const data: TenantUploadRow = {
      rut: rutNormalized,
      razonSocial,
      nombreComercial,
      vigente,
      email,
      telefono
    };

    if (!razonSocial || !nombreComercial) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "razonSocial y nombreComercial son obligatorios."
      };
    }
    if (rutNormalized && !isValidRutFormat(rutNormalized)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "RUT invalido. Usa formato 12345678-k (sin puntos)."
      };
    }

    const existing = existingMap.get(buildUploadTenantKey(rutNormalized, razonSocial, nombreComercial));
    if (!existing) {
      return { rowNumber, status: "NEW", data };
    }

    if (existing.vigente && !vigente && activeContractRuts.has(existing.rut)) {
      warnings.push(
        `Fila ${rowNumber}: no se desactiva ${existing.rut || "arrendatario"} porque tiene contratos VIGENTES asociados.`
      );
      return { rowNumber, status: "UNCHANGED", data };
    }

    const changedFields = compareWithExisting(data, existing);
    if (changedFields.length === 0) {
      return { rowNumber, status: "UNCHANGED", data };
    }

    return {
      rowNumber,
      status: "UPDATED",
      data,
      changedFields
    };
  });

  return {
    rows: previewRows,
    summary: summarize(previewRows),
    warnings
  };
}
