import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { read, utils } from "xlsx";
import { normalizeUploadRut } from "@/lib/upload/parse-arrendatarios";
import { MAX_ROWS, normalizeHeaders, parseDate } from "@/lib/upload/parse-utils";
import type { PreviewRow, UploadPreview, UploadIssue } from "@/types/upload";

type RawRow = Record<string, unknown>;

const requiredColumns = [
  "numerocontrato",
  "localcodigo",
  "arrendatariorut",
  "estado",
  "fechainicio",
  "fechatermino",
  "tarifatipo",
  "tarifavalor",
  "tarifavigenciadesde"
];

const allowedEstadoContrato = new Set(Object.values(EstadoContrato));
const allowedTipoTarifa = new Set(Object.values(TipoTarifaContrato));

export type ContratoUploadRow = {
  numeroContrato: string;
  localCodigo: string;
  arrendatarioRut: string;
  estado: EstadoContrato;
  fechaInicio: string;
  fechaTermino: string;
  tarifaTipo: TipoTarifaContrato;
  tarifaValor: string;
  tarifaVigenciaDesde: string;
  tarifaVigenciaHasta: string | null;
  pctRentaVariable: string | null;
  pctFondoPromocion: string | null;
  codigoCC: string | null;
  notas: string | null;
  ggccTarifaBaseUfM2: string | null;
  ggccPctAdministracion: string | null;
  ggccVigenciaDesde: string | null;
  ggccVigenciaHasta: string | null;
  anexoFecha: string | null;
  anexoDescripcion: string | null;
};

export type ExistingContratoForDiff = {
  numeroContrato: string;
  localCodigo: string;
  arrendatarioRut: string;
  estado: EstadoContrato;
  fechaInicio: string;
  fechaTermino: string;
  pctRentaVariable: string | null;
  pctFondoPromocion: string | null;
  codigoCC: string | null;
  notas: string | null;
  tarifas: Array<{
    tipo: TipoTarifaContrato;
    valor: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: string;
    pctAdministracion: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
  }>;
};

type ParseContratosOptions = {
  fileName?: string;
  existingContratos: Map<string, ExistingContratoForDiff>;
  existingLocalCodes: Set<string>;
  existingArrendatarioRuts: Set<string>;
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
  const normalized = asString(value);
  return normalized ? normalized : null;
}

function normalizeDecimal(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const numberValue = Number(value.replace(",", "."));
  if (!Number.isFinite(numberValue)) {
    return null;
  }
  return String(Number(numberValue.toFixed(6)));
}

function decimalEquals(left: string | null, right: string | null): boolean {
  return normalizeDecimal(left) === normalizeDecimal(right);
}

function isValidDecimalOrNull(value: string | null): boolean {
  return normalizeDecimal(value) !== null || value === null;
}

function emptyRow(): ContratoUploadRow {
  return {
    numeroContrato: "",
    localCodigo: "",
    arrendatarioRut: "",
    estado: EstadoContrato.VIGENTE,
    fechaInicio: "",
    fechaTermino: "",
    tarifaTipo: TipoTarifaContrato.FIJO_UF_M2,
    tarifaValor: "",
    tarifaVigenciaDesde: "",
    tarifaVigenciaHasta: null,
    pctRentaVariable: null,
    pctFondoPromocion: null,
    codigoCC: null,
    notas: null,
    ggccTarifaBaseUfM2: null,
    ggccPctAdministracion: null,
    ggccVigenciaDesde: null,
    ggccVigenciaHasta: null,
    anexoFecha: null,
    anexoDescripcion: null
  };
}

function summarize(rows: PreviewRow<ContratoUploadRow>[]): UploadPreview<ContratoUploadRow>["summary"] {
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
    { total: 0, nuevo: 0, actualizado: 0, sinCambio: 0, errores: 0 }
  );
}

function compareWithExisting(
  row: ContratoUploadRow,
  existing: ExistingContratoForDiff
): (keyof ContratoUploadRow)[] {
  const changed: (keyof ContratoUploadRow)[] = [];

  if (existing.localCodigo.toUpperCase() !== row.localCodigo.toUpperCase()) {
    changed.push("localCodigo");
  }
  if (normalizeUploadRut(existing.arrendatarioRut) !== normalizeUploadRut(row.arrendatarioRut)) {
    changed.push("arrendatarioRut");
  }
  if (existing.estado !== row.estado) {
    changed.push("estado");
  }
  if (existing.fechaInicio !== row.fechaInicio) {
    changed.push("fechaInicio");
  }
  if (existing.fechaTermino !== row.fechaTermino) {
    changed.push("fechaTermino");
  }
  if (!decimalEquals(existing.pctRentaVariable, row.pctRentaVariable)) {
    changed.push("pctRentaVariable");
  }
  if (!decimalEquals(existing.pctFondoPromocion, row.pctFondoPromocion)) {
    changed.push("pctFondoPromocion");
  }
  if ((existing.codigoCC ?? null) !== row.codigoCC) {
    changed.push("codigoCC");
  }
  if ((existing.notas ?? null) !== row.notas) {
    changed.push("notas");
  }

  const existingTarifa = existing.tarifas.find(
    (tarifa) => tarifa.tipo === row.tarifaTipo && tarifa.vigenciaDesde === row.tarifaVigenciaDesde
  );
  if (!existingTarifa) {
    changed.push("tarifaTipo", "tarifaValor", "tarifaVigenciaDesde");
  } else {
    if (!decimalEquals(existingTarifa.valor, row.tarifaValor)) {
      changed.push("tarifaValor");
    }
    if ((existingTarifa.vigenciaHasta ?? null) !== row.tarifaVigenciaHasta) {
      changed.push("tarifaVigenciaHasta");
    }
  }

  if (row.ggccTarifaBaseUfM2 && row.ggccPctAdministracion && row.ggccVigenciaDesde) {
    const existingGgcc = existing.ggcc.find((item) => item.vigenciaDesde === row.ggccVigenciaDesde);
    if (!existingGgcc) {
      changed.push("ggccTarifaBaseUfM2", "ggccPctAdministracion", "ggccVigenciaDesde");
    } else {
      if (!decimalEquals(existingGgcc.tarifaBaseUfM2, row.ggccTarifaBaseUfM2)) {
        changed.push("ggccTarifaBaseUfM2");
      }
      if (!decimalEquals(existingGgcc.pctAdministracion, row.ggccPctAdministracion)) {
        changed.push("ggccPctAdministracion");
      }
      if ((existingGgcc.vigenciaHasta ?? null) !== row.ggccVigenciaHasta) {
        changed.push("ggccVigenciaHasta");
      }
    }
  }

  if (row.anexoFecha && row.anexoDescripcion) {
    changed.push("anexoFecha", "anexoDescripcion");
  }

  return Array.from(new Set(changed));
}

export function parseContratosFile(
  buffer: ArrayBuffer,
  options: ParseContratosOptions
): UploadPreview<ContratoUploadRow> {
  const workbook = read(Buffer.from(buffer), { type: "buffer", raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    const rows: PreviewRow<ContratoUploadRow>[] = [
      { rowNumber: 0, status: "ERROR", data: emptyRow(), errorMessage: "El archivo no contiene hojas." }
    ];
    return { rows, summary: summarize(rows), warnings: [] };
  }

  const sourceRows = utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], {
    defval: "",
    raw: false
  });
  const normalizedRows = sourceRows.map((row) => normalizeHeaders(row));
  const warnings: string[] = [];

  if (options.fileName && !/\.(csv|xlsx|xls)$/i.test(options.fileName)) {
    warnings.push("Formato no estandar detectado. Se intento procesar igualmente.");
  }

  if (normalizedRows.length > MAX_ROWS) {
    const rows: PreviewRow<ContratoUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: `El archivo supera el maximo de ${MAX_ROWS} filas.`
      }
    ];
    return { rows, summary: summarize(rows), warnings };
  }

  const headers = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    const rows: PreviewRow<ContratoUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: `Faltan columnas requeridas: ${missing.join(", ")}`
      }
    ];
    return { rows, summary: summarize(rows), warnings };
  }

  const duplicatedTarifaKey = new Set<string>();

  const previewRows: PreviewRow<ContratoUploadRow>[] = normalizedRows.map((rawRow, index) => {
    const rowNumber = index + 2;
    const numeroContrato = asString(rawRow.numerocontrato);
    const localCodigo = asString(rawRow.localcodigo).toUpperCase();
    const arrendatarioRut = normalizeUploadRut(asString(rawRow.arrendatariorut));
    const estadoRaw = asString(rawRow.estado).toUpperCase();
    const fechaInicio = parseDate(rawRow.fechainicio);
    const fechaTermino = parseDate(rawRow.fechatermino);
    const tarifaTipoRaw = asString(rawRow.tarifatipo).toUpperCase();
    const tarifaValor = asString(rawRow.tarifavalor).replace(",", ".");
    const tarifaVigenciaDesde = parseDate(rawRow.tarifavigenciadesde);
    const tarifaVigenciaHasta = parseDate(rawRow.tarifavigenciahasta);
    const pctRentaVariable = normalizeNullable(rawRow.pctrentavariable);
    const pctFondoPromocion = normalizeNullable(rawRow.pctfondopromocion);
    const codigoCC = normalizeNullable(rawRow.codigocc);
    const notas = normalizeNullable(rawRow.notas);
    const ggccTarifaBaseUfM2 = normalizeNullable(rawRow.ggcctarifabaseufm2);
    const ggccPctAdministracion = normalizeNullable(rawRow.ggccpctadministracion);
    const ggccVigenciaDesde = parseDate(rawRow.ggccvigenciadesde);
    const ggccVigenciaHasta = parseDate(rawRow.ggccvigenciahasta);
    const anexoFecha = parseDate(rawRow.anexofecha);
    const anexoDescripcion = normalizeNullable(rawRow.anexodescripcion);

    const data: ContratoUploadRow = {
      numeroContrato,
      localCodigo,
      arrendatarioRut,
      estado: (estadoRaw || EstadoContrato.VIGENTE) as EstadoContrato,
      fechaInicio: fechaInicio ?? "",
      fechaTermino: fechaTermino ?? "",
      tarifaTipo: (tarifaTipoRaw || TipoTarifaContrato.FIJO_UF_M2) as TipoTarifaContrato,
      tarifaValor,
      tarifaVigenciaDesde: tarifaVigenciaDesde ?? "",
      tarifaVigenciaHasta,
      pctRentaVariable,
      pctFondoPromocion,
      codigoCC,
      notas,
      ggccTarifaBaseUfM2,
      ggccPctAdministracion,
      ggccVigenciaDesde,
      ggccVigenciaHasta,
      anexoFecha,
      anexoDescripcion
    };

    if (!numeroContrato || !localCodigo || !arrendatarioRut) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "numeroContrato, localCodigo y arrendatarioRut son obligatorios."
      };
    }
    if (!allowedEstadoContrato.has(data.estado)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Estado invalido: ${estadoRaw}`
      };
    }
    if (!allowedTipoTarifa.has(data.tarifaTipo)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Tipo de tarifa invalido: ${tarifaTipoRaw}`
      };
    }
    if (!data.fechaInicio || !data.fechaTermino || !data.tarifaVigenciaDesde) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Fechas obligatorias invalidas en contrato o tarifa."
      };
    }
    if (new Date(data.fechaInicio) > new Date(data.fechaTermino)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "fechaInicio no puede ser mayor que fechaTermino."
      };
    }
    if (!data.tarifaValor || Number.isNaN(Number(data.tarifaValor))) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "tarifaValor debe ser numerico."
      };
    }
    if (!isValidDecimalOrNull(data.pctRentaVariable) || !isValidDecimalOrNull(data.pctFondoPromocion)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "pctRentaVariable y pctFondoPromocion deben ser numericos cuando se informan."
      };
    }
    if (!isValidDecimalOrNull(data.ggccTarifaBaseUfM2) || !isValidDecimalOrNull(data.ggccPctAdministracion)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Campos de GGCC deben ser numericos cuando se informan."
      };
    }
    if (!/^\d{7,8}-[\dk]$/.test(data.arrendatarioRut)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "arrendatarioRut invalido. Usa formato 12345678-k."
      };
    }
    if (!options.existingLocalCodes.has(data.localCodigo)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Local '${data.localCodigo}' no existe. Sube locales primero.`
      };
    }
    if (!options.existingArrendatarioRuts.has(data.arrendatarioRut)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Arrendatario '${data.arrendatarioRut}' no existe. Sube arrendatarios primero.`
      };
    }

    const hasAnyGgccValue = Boolean(
      data.ggccTarifaBaseUfM2 || data.ggccPctAdministracion || data.ggccVigenciaDesde
    );
    const hasCompleteGgcc = Boolean(
      data.ggccTarifaBaseUfM2 && data.ggccPctAdministracion && data.ggccVigenciaDesde
    );
    if (hasAnyGgccValue && !hasCompleteGgcc) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage:
          "GGCC incompleto: si informas GGCC debes incluir ggccTarifaBaseUfM2, ggccPctAdministracion y ggccVigenciaDesde."
      };
    }

    if ((data.anexoFecha && !data.anexoDescripcion) || (!data.anexoFecha && data.anexoDescripcion)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Anexo incompleto: anexoFecha y anexoDescripcion deben venir juntos."
      };
    }

    const tarifaKey = `${numeroContrato}-${data.tarifaTipo}-${data.tarifaVigenciaDesde}`;
    if (duplicatedTarifaKey.has(tarifaKey)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Tarifa duplicada en el archivo para numeroContrato + tipo + vigenciaDesde."
      };
    }
    duplicatedTarifaKey.add(tarifaKey);

    const existing = options.existingContratos.get(numeroContrato);
    if (!existing) {
      return {
        rowNumber,
        status: "NEW",
        data
      };
    }

    const changedFields = compareWithExisting(data, existing);
    if (changedFields.length === 0) {
      return {
        rowNumber,
        status: "UNCHANGED",
        data
      };
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

export function buildErrorCsv(issues: UploadIssue[]): string {
  const header = "rowNumber,message";
  const lines = issues.map((issue) => `${issue.rowNumber},"${issue.message.replaceAll('"', '""')}"`);
  return [header, ...lines].join("\n");
}
