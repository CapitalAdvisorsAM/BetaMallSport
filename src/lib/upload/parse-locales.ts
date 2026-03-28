import { EstadoMaestro, LocalTipo } from "@prisma/client";
import { read, utils } from "xlsx";
import { MAX_ROWS, normalizeHeaders } from "@/lib/upload/parse-utils";
import type { PreviewRow, UploadPreview } from "@/types/upload";

type RawRow = Record<string, unknown>;

export type LocalUploadRow = {
  codigo: string;
  nombre: string;
  glam2: string;
  piso: string;
  tipo: LocalTipo;
  zona: string | null;
  esGLA: boolean;
  estado: EstadoMaestro;
};

export type ExistingLocalForDiff = {
  codigo: string;
  nombre: string;
  glam2: string | number;
  piso: string;
  tipo: LocalTipo;
  zona: string | null;
  esGLA: boolean;
  estado: EstadoMaestro;
};

const requiredColumns = ["codigo", "nombre", "glam2", "piso", "tipo"];
const trueLiterals = new Set(["true", "1", "si", "sí", "yes", "y"]);
const allowedTipo = new Set(Object.values(LocalTipo));
const allowedEstado = new Set(Object.values(EstadoMaestro));

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

function parsePositiveNumber(value: unknown): number | null {
  const raw = asString(value).replace(",", ".");
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
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

function emptyRow(): LocalUploadRow {
  return {
    codigo: "",
    nombre: "",
    glam2: "",
    piso: "",
    tipo: LocalTipo.TIENDA,
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

  const headers = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
  const missing = requiredColumns.filter((column) => !headers.includes(column));
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

  const previewRows: PreviewRow<LocalUploadRow>[] = normalizedRows.map((rawRow, index) => {
    const rowNumber = index + 2;
    const codigo = asString(rawRow.codigo).toUpperCase();
    const nombre = asString(rawRow.nombre);
    const glam2Number = parsePositiveNumber(rawRow.glam2);
    const piso = asString(rawRow.piso);
    const tipoRaw = asString(rawRow.tipo).toUpperCase();
    const zona = normalizeNullable(rawRow.zona);
    const esGLA = parseBoolean(rawRow.esgla);
    const estadoRaw = asString(rawRow.estado).toUpperCase();
    const estado = (estadoRaw || EstadoMaestro.ACTIVO) as EstadoMaestro;

    const data: LocalUploadRow = {
      codigo,
      nombre,
      glam2: glam2Number ? toDecimalText(glam2Number) : "",
      piso,
      tipo: (tipoRaw || LocalTipo.TIENDA) as LocalTipo,
      zona,
      esGLA,
      estado
    };

    if (!codigo || !nombre || !piso || !tipoRaw || glam2Number === null) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "codigo, nombre, glam2, piso y tipo son obligatorios. glam2 debe ser > 0."
      };
    }
    if (!allowedTipo.has(data.tipo)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `tipo invalido: ${tipoRaw}. Valores permitidos: ${Object.values(LocalTipo).join(", ")}.`
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

    const existing = existingMap.get(codigo);
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
    warnings: []
  };
}
