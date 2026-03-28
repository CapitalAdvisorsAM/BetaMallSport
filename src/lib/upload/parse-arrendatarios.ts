import { read, utils } from "xlsx";
import { MAX_ROWS, normalizeHeaders } from "@/lib/upload/parse-utils";
import type { PreviewRow, UploadPreview } from "@/types/upload";

type RawRow = Record<string, unknown>;

const requiredColumns = ["rut", "razonsocial", "nombrecomercial"];
const trueLiterals = new Set(["true", "1", "si", "sí", "yes", "y"]);
const falseLiterals = new Set(["false", "0", "no", "n"]);

export type ArrendatarioUploadRow = {
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  vigente: boolean;
  email: string | null;
  telefono: string | null;
};

export type ExistingArrendatarioForDiff = {
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
  if (!cleaned.includes("-")) {
    return cleaned.toLowerCase();
  }
  const [numberPart, dvPart] = cleaned.split("-");
  return `${numberPart}-${dvPart.toLowerCase()}`;
}

function isValidRutFormat(value: string): boolean {
  return /^\d{7,8}-[\dk]$/.test(value);
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

function emptyRow(): ArrendatarioUploadRow {
  return {
    rut: "",
    razonSocial: "",
    nombreComercial: "",
    vigente: true,
    email: null,
    telefono: null
  };
}

function summarize(rows: PreviewRow<ArrendatarioUploadRow>[]): UploadPreview<ArrendatarioUploadRow>["summary"] {
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
  row: ArrendatarioUploadRow,
  existing: ExistingArrendatarioForDiff
): (keyof ArrendatarioUploadRow)[] {
  const changed: (keyof ArrendatarioUploadRow)[] = [];
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

export function parseArrendatariosFile(
  buffer: ArrayBuffer,
  existingMap: Map<string, ExistingArrendatarioForDiff>,
  activeContractRuts: Set<string>
): UploadPreview<ArrendatarioUploadRow> {
  const workbook = read(Buffer.from(buffer), { type: "buffer", raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    const rows: PreviewRow<ArrendatarioUploadRow>[] = [
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
    raw: false
  });
  const normalizedRows = sourceRows.map((row) => normalizeHeaders(row));

  if (normalizedRows.length > MAX_ROWS) {
    const rows: PreviewRow<ArrendatarioUploadRow>[] = [
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
    const rows: PreviewRow<ArrendatarioUploadRow>[] = [
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

  const previewRows: PreviewRow<ArrendatarioUploadRow>[] = normalizedRows.map((rawRow, index) => {
    const rowNumber = index + 2;
    const rutNormalized = normalizeUploadRut(asString(rawRow.rut));
    const razonSocial = asString(rawRow.razonsocial);
    const nombreComercial = asString(rawRow.nombrecomercial);
    const vigente = parseBoolean(rawRow.vigente, true);
    const email = normalizeNullable(rawRow.email);
    const telefono = normalizeNullable(rawRow.telefono);

    const data: ArrendatarioUploadRow = {
      rut: rutNormalized,
      razonSocial,
      nombreComercial,
      vigente,
      email,
      telefono
    };

    if (!rutNormalized || !razonSocial || !nombreComercial) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "rut, razonSocial y nombreComercial son obligatorios."
      };
    }
    if (!isValidRutFormat(rutNormalized)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "RUT invalido. Usa formato 12345678-k (sin puntos)."
      };
    }

    const existing = existingMap.get(rutNormalized);
    if (!existing) {
      return { rowNumber, status: "NEW", data };
    }

    if (existing.vigente && !vigente && activeContractRuts.has(rutNormalized)) {
      warnings.push(
        `Fila ${rowNumber}: no se desactiva RUT ${rutNormalized} porque tiene contratos VIGENTES asociados.`
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
