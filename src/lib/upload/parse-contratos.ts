import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { read, utils } from "xlsx";
import { normalizeUploadRut } from "@/lib/upload/parse-arrendatarios";
import { MAX_ROWS, normalizeHeaders, parseDate } from "@/lib/upload/parse-utils";
import type { PreviewRow, UploadIssue, UploadPreview } from "@/types/upload";

type RawRow = Record<string, unknown>;
type GgccTipoInput = "FIJO_UF_M2" | "FIJO_UF";

const requiredColumns = [
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
const allowedGgccTipo = new Set<GgccTipoInput>(["FIJO_UF_M2", "FIJO_UF"]);

export type ContratoUploadRow = {
  numeroContrato: string;
  localCodigo: string;
  arrendatarioRut: string;
  estado: EstadoContrato;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  tarifaTipo: TipoTarifaContrato;
  tarifaValor: string;
  tarifaVigenciaDesde: string;
  tarifaVigenciaHasta: string | null;
  pctFondoPromocion: string | null;
  multiplicadorDiciembre: string | null;
  codigoCC: string | null;
  ggccPctAdministracion: string | null;
  ggccPctReajuste: string | null;
  notas: string | null;
  ggccTipo: GgccTipoInput | null;
  ggccValor: string | null;
  ggccVigenciaDesde: string | null;
  ggccVigenciaHasta: string | null;
  ggccMesesReajuste: number | null;
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
  fechaEntrega: string | null;
  fechaApertura: string | null;
  pctFondoPromocion: string | null;
  multiplicadorDiciembre: string | null;
  codigoCC: string | null;
  ggccPctAdministracion: string | null;
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
    pctReajuste: string | null;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    mesesReajuste: number | null;
  }>;
};

type ParseContratosOptions = {
  fileName?: string;
  existingContratos: Map<string, ExistingContratoForDiff>;
  existingLocalData: Map<string, { glam2: string }>;
  existingArrendatarioRuts: Set<string>;
};

export function buildContratoLookupKey(input: {
  numeroContrato?: string | null;
  localCodigo?: string | null;
  arrendatarioRut?: string | null;
  fechaInicio?: string | null;
  fechaTermino?: string | null;
}): string {
  const numeroContrato = (input.numeroContrato ?? "").trim();
  if (numeroContrato) {
    return `numero:${numeroContrato.toUpperCase()}`;
  }

  return [
    "natural",
    (input.localCodigo ?? "").trim().toUpperCase(),
    normalizeUploadRut(input.arrendatarioRut ?? ""),
    input.fechaInicio ?? "",
    input.fechaTermino ?? ""
  ].join("|");
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

function integerOrNull(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    return null;
  }
  return numberValue;
}

function normalizeGgccTipo(value: unknown, hasGgccValue: boolean): GgccTipoInput | null {
  const normalized = asString(value).toUpperCase();
  if (!normalized) {
    return hasGgccValue ? "FIJO_UF_M2" : null;
  }
  if (!allowedGgccTipo.has(normalized as GgccTipoInput)) {
    return null;
  }
  return normalized as GgccTipoInput;
}

function parsePositiveDecimal(value: string | null): number | null {
  const normalized = normalizeDecimal(value);
  if (!normalized) {
    return null;
  }
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function toStoredGgccTarifaBaseUfM2(
  ggccTipo: GgccTipoInput | null,
  ggccValor: string | null,
  glam2: string | null
): string | null {
  const normalizedValue = normalizeDecimal(ggccValor);
  if (!normalizedValue || !ggccTipo) {
    return null;
  }

  if (ggccTipo === "FIJO_UF_M2") {
    return normalizedValue;
  }

  const glam2Number = parsePositiveDecimal(glam2);
  if (!glam2Number) {
    return null;
  }

  return normalizeDecimal(String(Number(normalizedValue) / glam2Number));
}

function emptyRow(): ContratoUploadRow {
  return {
    numeroContrato: "",
    localCodigo: "",
    arrendatarioRut: "",
    estado: EstadoContrato.VIGENTE,
    fechaInicio: "",
    fechaTermino: "",
    fechaEntrega: null,
    fechaApertura: null,
    tarifaTipo: TipoTarifaContrato.FIJO_UF_M2,
    tarifaValor: "",
    tarifaVigenciaDesde: "",
    tarifaVigenciaHasta: null,
    pctFondoPromocion: null,
    multiplicadorDiciembre: null,
    codigoCC: null,
    ggccPctAdministracion: null,
    ggccPctReajuste: null,
    notas: null,
    ggccTipo: null,
    ggccValor: null,
    ggccVigenciaDesde: null,
    ggccVigenciaHasta: null,
    ggccMesesReajuste: null,
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
  existing: ExistingContratoForDiff,
  glam2: string | null
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
  if ((existing.fechaEntrega ?? null) !== row.fechaEntrega) {
    changed.push("fechaEntrega");
  }
  if ((existing.fechaApertura ?? null) !== row.fechaApertura) {
    changed.push("fechaApertura");
  }
  if (!decimalEquals(existing.pctFondoPromocion, row.pctFondoPromocion)) {
    changed.push("pctFondoPromocion");
  }
  if (!decimalEquals(existing.multiplicadorDiciembre, row.multiplicadorDiciembre)) {
    changed.push("multiplicadorDiciembre");
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

  if (row.ggccTipo && row.ggccValor && row.ggccPctAdministracion && row.ggccVigenciaDesde) {
    const existingGgcc = existing.ggcc.find((item) => item.vigenciaDesde === row.ggccVigenciaDesde);
    const storedTarifaBase = toStoredGgccTarifaBaseUfM2(row.ggccTipo, row.ggccValor, glam2);
    if (!existingGgcc || !storedTarifaBase) {
      changed.push(
        "ggccTipo",
        "ggccValor",
        "ggccPctAdministracion",
        "ggccPctReajuste",
        "ggccVigenciaDesde"
      );
    } else {
      if (!decimalEquals(existingGgcc.tarifaBaseUfM2, storedTarifaBase)) {
        changed.push("ggccTipo", "ggccValor");
      }
      if (!decimalEquals(existingGgcc.pctAdministracion, row.ggccPctAdministracion)) {
        changed.push("ggccPctAdministracion");
      }
      if (!decimalEquals(existingGgcc.pctReajuste ?? null, row.ggccPctReajuste)) {
        changed.push("ggccPctReajuste");
      }
      if ((existingGgcc.vigenciaHasta ?? null) !== row.ggccVigenciaHasta) {
        changed.push("ggccVigenciaHasta");
      }
      if ((existingGgcc.mesesReajuste ?? null) !== row.ggccMesesReajuste) {
        changed.push("ggccMesesReajuste");
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
    raw: false,
    range: 2
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
    const fechaEntrega = parseDate(rawRow.fechaentrega);
    const fechaApertura = parseDate(rawRow.fechaapertura);
    const tarifaTipoRaw = asString(rawRow.tarifatipo).toUpperCase();
    const tarifaValor = asString(rawRow.tarifavalor).replace(",", ".");
    const tarifaVigenciaDesde = parseDate(rawRow.tarifavigenciadesde);
    const tarifaVigenciaHasta = parseDate(rawRow.tarifavigenciahasta);
    const rentaVariablePct = normalizeNullable(rawRow.rentavariablepct);
    const pctFondoPromocion = normalizeNullable(rawRow.pctfondopromocion);
    const multiplicadorDiciembre = normalizeNullable(rawRow.multiplicadordiciembre);
    const codigoCC = normalizeNullable(rawRow.codigocc);
    const ggccPctAdministracion = normalizeNullable(rawRow.ggccpctadministracion);
    const ggccPctReajuste = normalizeNullable(rawRow.ggccpctreajuste);
    const notas = normalizeNullable(rawRow.notas);
    const legacyGgccValue = normalizeNullable(rawRow.ggcctarifabaseufm2);
    const ggccValor = normalizeNullable(rawRow.ggccvalor) ?? legacyGgccValue;
    const ggccTipo = normalizeGgccTipo(rawRow.ggcctipo, Boolean(ggccValor));
    const ggccVigenciaDesde = parseDate(rawRow.ggccvigenciadesde);
    const ggccVigenciaHasta = parseDate(rawRow.ggccvigenciahasta);
    const ggccMesesReajuste = integerOrNull(normalizeNullable(rawRow.ggccmesesreajuste));
    const anexoFecha = parseDate(rawRow.anexofecha);
    const anexoDescripcion = normalizeNullable(rawRow.anexodescripcion);

    const hasAnyRentaVariableValue = Boolean(rentaVariablePct);
    if (hasAnyRentaVariableValue && tarifaTipoRaw && tarifaTipoRaw !== "PORCENTAJE") {
      return {
        rowNumber,
        status: "ERROR",
        data: emptyRow(),
        errorMessage:
          "No mezcles tarifaTipo fijo con rentaVariablePct. Usa tarifaTipo=PORCENTAJE o deja el tipo vacio."
      };
    }

    const tarifaTipoFinal = (
      hasAnyRentaVariableValue ? "PORCENTAJE" : tarifaTipoRaw || TipoTarifaContrato.FIJO_UF_M2
    ) as TipoTarifaContrato;
    const tarifaUsaFechasContrato = tarifaTipoFinal === TipoTarifaContrato.PORCENTAJE;
    const tarifaValorFinal = (hasAnyRentaVariableValue ? rentaVariablePct : tarifaValor) ?? "";
    const tarifaVigenciaDesdeFinal = tarifaUsaFechasContrato ? fechaInicio : tarifaVigenciaDesde;
    const tarifaVigenciaHastaFinal = tarifaUsaFechasContrato ? fechaTermino : tarifaVigenciaHasta;

    const data: ContratoUploadRow = {
      numeroContrato,
      localCodigo,
      arrendatarioRut,
      estado: (estadoRaw || EstadoContrato.VIGENTE) as EstadoContrato,
      fechaInicio: fechaInicio ?? "",
      fechaTermino: fechaTermino ?? "",
      fechaEntrega,
      fechaApertura,
      tarifaTipo: tarifaTipoFinal,
      tarifaValor: tarifaValorFinal.replace(",", "."),
      tarifaVigenciaDesde: tarifaVigenciaDesdeFinal ?? "",
      tarifaVigenciaHasta: tarifaVigenciaHastaFinal,
      pctFondoPromocion,
      multiplicadorDiciembre,
      codigoCC,
      ggccPctAdministracion,
      ggccPctReajuste,
      notas,
      ggccTipo,
      ggccValor,
      ggccVigenciaDesde,
      ggccVigenciaHasta,
      ggccMesesReajuste,
      anexoFecha,
      anexoDescripcion
    };

    if (!localCodigo || !arrendatarioRut) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "localCodigo y arrendatarioRut son obligatorios."
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
    if (!isValidDecimalOrNull(data.pctFondoPromocion)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "pctFondoPromocion debe ser numerico cuando se informa."
      };
    }
    if (!isValidDecimalOrNull(data.multiplicadorDiciembre)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "multiplicadorDiciembre debe ser numerico cuando se informa."
      };
    }
    if (
      !isValidDecimalOrNull(data.ggccValor) ||
      !isValidDecimalOrNull(data.ggccPctAdministracion) ||
      !isValidDecimalOrNull(data.ggccPctReajuste)
    ) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Campos de GGCC deben ser numericos cuando se informan."
      };
    }
    if (normalizeNullable(rawRow.ggccmesesreajuste) && data.ggccMesesReajuste === null) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "ggccMesesReajuste debe ser un entero mayor o igual a 1."
      };
    }
    if (data.ggccMesesReajuste !== null && !data.ggccPctReajuste) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "ggccPctReajuste es obligatorio cuando se informa ggccMesesReajuste."
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

    const localData = options.existingLocalData.get(data.localCodigo);
    if (!localData) {
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
      data.ggccTipo ||
        data.ggccValor ||
        data.ggccPctAdministracion ||
        data.ggccPctReajuste ||
        data.ggccVigenciaDesde ||
        data.ggccVigenciaHasta ||
        data.ggccMesesReajuste !== null
    );
    const ggccTarifaBaseUfM2 = toStoredGgccTarifaBaseUfM2(data.ggccTipo, data.ggccValor, localData.glam2);
    const hasCompleteGgcc = Boolean(
      data.ggccTipo &&
        data.ggccValor &&
        data.ggccPctAdministracion &&
        data.ggccVigenciaDesde &&
        ggccTarifaBaseUfM2
    );
    if (hasAnyGgccValue && !hasCompleteGgcc) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage:
          "GGCC incompleto: si informas GGCC debes incluir ggccTipo, ggccValor, ggccPctAdministracion y ggccVigenciaDesde."
      };
    }
    if (data.ggccTipo === null && normalizeNullable(rawRow.ggcctipo)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "ggccTipo invalido. Usa FIJO_UF_M2 o FIJO_UF."
      };
    }
    if (data.ggccTipo === "FIJO_UF" && !parsePositiveDecimal(localData.glam2)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `El local '${data.localCodigo}' no tiene GLA valida para convertir GGCC FIJO_UF a UF/m2.`
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

    const contratoLookupKey = buildContratoLookupKey({
      numeroContrato,
      localCodigo: data.localCodigo,
      arrendatarioRut: data.arrendatarioRut,
      fechaInicio: data.fechaInicio,
      fechaTermino: data.fechaTermino
    });
    const tarifaKey = `${contratoLookupKey}-${data.tarifaTipo}-${data.tarifaVigenciaDesde}`;
    if (duplicatedTarifaKey.has(tarifaKey)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Tarifa duplicada en el archivo para numeroContrato + tipo + vigenciaDesde."
      };
    }
    duplicatedTarifaKey.add(tarifaKey);

    const existing = options.existingContratos.get(contratoLookupKey);
    if (!existing) {
      return {
        rowNumber,
        status: "NEW",
        data
      };
    }

    const changedFields = compareWithExisting(data, existing, localData.glam2);
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
  const lines = issues.map((issue) => `${issue.rowNumber},\"${issue.message.replaceAll("\"", "\"\"")}\"`);
  return [header, ...lines].join("\n");
}
