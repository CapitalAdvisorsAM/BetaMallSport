import { EstadoMaestro, TipoLocal } from "@prisma/client";
import { read, utils } from "xlsx";
import { MAX_ROWS, normalizeHeaders } from "@/lib/upload/parse-utils";
import type { PreviewRow, UploadPreview } from "@/types/upload";

type RawRow = Record<string, unknown>;

export type LocalUploadRow = {
  codigo: string;
  nombre: string;
  glam2: string;
  piso: string;
  tipo: TipoLocal;
  zona: string | null;
  esGLA: boolean;
  estado: EstadoMaestro;
};

export type ExistingLocalForDiff = {
  codigo: string;
  nombre: string;
  glam2: string | number;
  piso: string;
  tipo: TipoLocal;
  zona: string | null;
  esGLA: boolean;
  estado: EstadoMaestro;
};

const requiredColumns = ["codigo", "piso", "tipo"];
const trueLiterals = new Set(["true", "1", "si", "s\u00ed", "yes", "y"]);
const allowedTipo = new Set(Object.values(TipoLocal));
const allowedEstado = new Set(Object.values(EstadoMaestro));
const tipoAliases: Record<string, TipoLocal> = {
  LOCAL_COMERCIAL: TipoLocal.LOCAL_COMERCIAL,
  TIENDA: TipoLocal.LOCAL_COMERCIAL,
  SIMULADOR: TipoLocal.SIMULADOR,
  MODULO: TipoLocal.MODULO,
  ESPACIO: TipoLocal.ESPACIO,
  BODEGA: TipoLocal.BODEGA,
  OTRO: TipoLocal.OTRO
};

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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
  const normalized = asString(value);
  return normalized ? normalized : null;
}

function parseNonNegativeNumber(value: string): number | null {
  const normalized = value.replace(",", ".");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function toDecimalText(value: number): string {
  return String(Number(value.toFixed(4)));
}

function parseBoolean(value: unknown): boolean {
  const normalized = asString(value).toLowerCase();
  return trueLiterals.has(normalized);
}

function parseTipo(rawTipo: string): TipoLocal | null {
  return tipoAliases[rawTipo] ?? null;
}

function emptyRow(): LocalUploadRow {
  return {
    codigo: "",
    nombre: "",
    glam2: "",
    piso: "",
    tipo: TipoLocal.LOCAL_COMERCIAL,
    zona: null,
    esGLA: false,
    estado: EstadoMaestro.ACTIVO
  };
}

function summarize(rows: PreviewRow<LocalUploadRow>[]): UploadPreview<LocalUploadRow>["summary"] {
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
  row: LocalUploadRow,
  existing: ExistingLocalForDiff
): (keyof LocalUploadRow)[] {
  const changed: (keyof LocalUploadRow)[] = [];
  if (existing.nombre.trim() !== row.nombre) {
    changed.push("nombre");
  }
  if (Math.abs(Number(existing.glam2) - Number(row.glam2)) > 0.0001) {
    changed.push("glam2");
  }
  if (existing.piso.trim() !== row.piso) {
    changed.push("piso");
  }
  if (existing.tipo !== row.tipo) {
    changed.push("tipo");
  }
  if ((existing.zona ?? null) !== row.zona) {
    changed.push("zona");
  }
  if (existing.esGLA !== row.esGLA) {
    changed.push("esGLA");
  }
  if (existing.estado !== row.estado) {
    changed.push("estado");
  }
  return changed;
}

export function parseLocalesFile(
  buffer: ArrayBuffer,
  existingMap: Map<string, ExistingLocalForDiff>
): UploadPreview<LocalUploadRow> {
  const workbook = read(Buffer.from(buffer), { type: "buffer", raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    const rows: PreviewRow<LocalUploadRow>[] = [
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
    range: 2,
    defval: "",
    raw: false
  });
  const normalizedRows = sourceRows.map((row) => normalizeHeaders(row));

  if (normalizedRows.length > MAX_ROWS) {
    const rows: PreviewRow<LocalUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: `El archivo supera el maximo de ${MAX_ROWS} filas.`
      }
    ];
    return { rows, summary: summarize(rows), warnings: [] };
  }

  const headers =
    normalizedRows.length > 0
      ? Object.keys(normalizedRows[0]).map((header) => header.trim().toLowerCase())
      : [];
  const missing = requiredColumns.filter((column) => !headers.includes(column.trim().toLowerCase()));
  if (missing.length > 0) {
    const rows: PreviewRow<LocalUploadRow>[] = [
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
  const seenCodes = new Map<string, number>();

  const previewRows: PreviewRow<LocalUploadRow>[] = normalizedRows.map((rawRow, index) => {
    const rowNumber = index + 2;
    const codigo = asString(rawRow.codigo).toUpperCase();
    const rawNombre = asString(rawRow.nombre);
    const glam2Raw = asString(rawRow.glam2);
    const glam2Number = parseNonNegativeNumber(glam2Raw);
    const glam2WasProvided = glam2Raw.length > 0;
    const piso = asString(rawRow.piso);
    const tipoRaw = normalizeToken(asString(rawRow.tipo));
    const zona = normalizeNullable(rawRow.zona);
    const esGLA = parseBoolean(rawRow.esgla);
    const estadoRaw = normalizeToken(asString(rawRow.estado));
    const estado = (estadoRaw || EstadoMaestro.ACTIVO) as EstadoMaestro;
    const tipo = parseTipo(tipoRaw || "LOCAL_COMERCIAL");
    const existing = codigo ? existingMap.get(codigo) : undefined;
    const existingGlam2 = Number(existing?.glam2 ?? 0);
    const glam2Fallback = Number.isFinite(existingGlam2) && existingGlam2 >= 0 ? existingGlam2 : 0;
    const nombre = rawNombre || existing?.nombre?.trim() || codigo;
    const glam2Value = glam2WasProvided
      ? (glam2Number === null ? glam2Raw.replace(",", ".") : toDecimalText(glam2Number))
      : toDecimalText(glam2Fallback);

    const data: LocalUploadRow = {
      codigo,
      nombre,
      glam2: glam2Value,
      piso,
      tipo: tipo ?? TipoLocal.LOCAL_COMERCIAL,
      zona,
      esGLA,
      estado
    };

    const missingFields: string[] = [];
    if (!codigo) {
      missingFields.push("codigo");
    }
    if (!piso) {
      missingFields.push("piso");
    }
    if (!tipoRaw) {
      missingFields.push("tipo");
    }

    if (missingFields.length > 0) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Campos invalidos o faltantes: ${missingFields.join(", ")}.`
      };
    }
    if (!tipo || !allowedTipo.has(data.tipo)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `tipo invalido: ${tipoRaw}. Valores permitidos: ${Object.values(TipoLocal).join(", ")}.`
      };
    }
    if (!allowedEstado.has(data.estado)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `estado invalido: ${estadoRaw}. Valores permitidos: ${Object.values(EstadoMaestro).join(", ")}.`
      };
    }
    if (glam2WasProvided && glam2Number === null) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "glam2 invalido. Debe ser numerico mayor o igual a 0."
      };
    }
    if (!glam2WasProvided) {
      warnings.push(
        `Fila ${rowNumber}: GLA m2 vacio, se usara ${toDecimalText(glam2Fallback)}.`
      );
    }
    if (codigo) {
      const firstSeenRow = seenCodes.get(codigo);
      if (firstSeenRow !== undefined) {
        return {
          rowNumber,
          status: "ERROR",
          data,
          errorMessage: `codigo duplicado en el archivo: ${codigo}. Ya aparece en la fila ${firstSeenRow}.`
        };
      }
      seenCodes.set(codigo, rowNumber);
    }

    if (!existing) {
      return { rowNumber, status: "NEW", data };
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
