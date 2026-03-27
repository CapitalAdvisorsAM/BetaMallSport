import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { utils, read } from "xlsx";
import type { RentRollPreviewPayload, RentRollUploadRow, UploadIssue } from "@/types";

type RawRow = Record<string, string | number | boolean | null | undefined>;

const requiredColumns = [
  "numeroContrato",
  "localCodigo",
  "arrendatarioRut",
  "estado",
  "fechaInicio",
  "fechaTermino",
  "tarifaTipo",
  "tarifaValor",
  "tarifaVigenciaDesde"
];

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
  const raw = asString(value);
  return raw.length > 0 ? raw : null;
}

function normalizeDate(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function isEstadoContrato(value: string): value is EstadoContrato {
  return ["VIGENTE", "TERMINADO", "TERMINADO_ANTICIPADO", "GRACIA"].includes(value);
}

function isTipoTarifa(value: string): value is `${TipoTarifaContrato}` {
  return ["FIJO_UF_M2", "FIJO_UF", "PORCENTAJE"].includes(value);
}

export function parseRentRollFile(fileName: string, buffer: Buffer): RentRollPreviewPayload {
  const workbook = read(buffer, { type: "buffer", raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, message: "El archivo no contiene hojas." }],
      warnings: [],
      summary: { totalRows: 0, validRows: 0, errorRows: 1 }
    };
  }

  const rows = utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], {
    defval: "",
    raw: false
  });

  const warnings: string[] = [];
  if (!/\.(csv|xlsx)$/i.test(fileName)) {
    warnings.push("Formato no estandar detectado. Se intento procesar igualmente.");
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ rowNumber: 0, message: `Faltan columnas requeridas: ${missing.join(", ")}` }],
      warnings,
      summary: { totalRows: rows.length, validRows: 0, errorRows: 1 }
    };
  }

  const validRows: RentRollUploadRow[] = [];
  const errors: UploadIssue[] = [];

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const numeroContrato = asString(rawRow.numeroContrato);
    const localCodigo = asString(rawRow.localCodigo);
    const arrendatarioRut = asString(rawRow.arrendatarioRut);
    const estadoRaw = asString(rawRow.estado).toUpperCase();
    const fechaInicio = normalizeDate(rawRow.fechaInicio);
    const fechaTermino = normalizeDate(rawRow.fechaTermino);
    const tarifaTipoRaw = asString(rawRow.tarifaTipo).toUpperCase();
    const tarifaValor = asString(rawRow.tarifaValor);
    const tarifaVigenciaDesde = normalizeDate(rawRow.tarifaVigenciaDesde);

    if (!numeroContrato || !localCodigo || !arrendatarioRut) {
      errors.push({ rowNumber, message: "numeroContrato, localCodigo y arrendatarioRut son obligatorios." });
      return;
    }
    if (!isEstadoContrato(estadoRaw)) {
      errors.push({ rowNumber, message: `Estado invalido: ${estadoRaw}` });
      return;
    }
    if (!isTipoTarifa(tarifaTipoRaw)) {
      errors.push({ rowNumber, message: `Tipo de tarifa invalido: ${tarifaTipoRaw}` });
      return;
    }
    if (!fechaInicio || !fechaTermino || !tarifaVigenciaDesde) {
      errors.push({ rowNumber, message: "Fechas obligatorias invalidas en contrato o tarifa." });
      return;
    }
    if (new Date(fechaInicio) > new Date(fechaTermino)) {
      errors.push({ rowNumber, message: "fechaInicio no puede ser mayor que fechaTermino." });
      return;
    }
    if (!tarifaValor || Number.isNaN(Number(tarifaValor))) {
      errors.push({ rowNumber, message: "tarifaValor debe ser numerico." });
      return;
    }

    validRows.push({
      rowNumber,
      numeroContrato,
      localCodigo,
      arrendatarioRut,
      estado: estadoRaw,
      fechaInicio,
      fechaTermino,
      tarifaTipo: tarifaTipoRaw,
      tarifaValor,
      tarifaVigenciaDesde,
      tarifaVigenciaHasta: normalizeDate(rawRow.tarifaVigenciaHasta),
      pctRentaVariable: normalizeNullable(rawRow.pctRentaVariable),
      pctFondoPromocion: normalizeNullable(rawRow.pctFondoPromocion),
      codigoCC: normalizeNullable(rawRow.codigoCC),
      notas: normalizeNullable(rawRow.notas),
      ggccTarifaBaseUfM2: normalizeNullable(rawRow.ggccTarifaBaseUfM2),
      ggccPctAdministracion: normalizeNullable(rawRow.ggccPctAdministracion),
      ggccVigenciaDesde: normalizeDate(rawRow.ggccVigenciaDesde),
      ggccVigenciaHasta: normalizeDate(rawRow.ggccVigenciaHasta),
      anexoFecha: normalizeDate(rawRow.anexoFecha),
      anexoDescripcion: normalizeNullable(rawRow.anexoDescripcion)
    });
  });

  return {
    rows: validRows,
    errors,
    warnings,
    summary: {
      totalRows: rows.length,
      validRows: validRows.length,
      errorRows: errors.length
    }
  };
}

export function buildErrorCsv(issues: UploadIssue[]): string {
  const header = "rowNumber,message";
  const lines = issues.map((issue) => `${issue.rowNumber},"${issue.message.replaceAll('"', '""')}"`);
  return [header, ...lines].join("\n");
}
