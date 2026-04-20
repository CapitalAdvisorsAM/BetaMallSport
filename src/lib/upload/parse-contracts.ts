import { ContractRateType } from "@prisma/client";
import { read, utils } from "xlsx";
import { MAX_ROWS, normalizeHeaders, parseDate } from "@/lib/upload/parse-utils";
import type {
  ContractReconciliation,
  ContractReconciliationItem,
  PreviewRow,
  UploadIssue,
  UploadPreview
} from "@/types/upload";

type RawRow = Record<string, unknown>;
type GgccTipoInput = "FIJO_UF_M2" | "FIJO_UF";

const requiredColumns = [
  "localcodigo",
  "arrendatarionombre",
  "fechainicio",
  "fechatermino",
  "tarifatipo",
  "tarifavalor",
  "tarifavigenciadesde"
];

const allowedTipoTarifa = new Set(Object.values(ContractRateType));
const allowedGgccTipo = new Set<GgccTipoInput>(["FIJO_UF_M2", "FIJO_UF"]);

export type ContractUploadRow = {
  numeroContrato: string;
  localCodigo: string;
  arrendatarioNombre: string;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  tarifaTipo: ContractRateType;
  tarifaValor: string;
  tarifaVigenciaDesde: string;
  tarifaVigenciaHasta: string | null;
  tarifa2Valor: string | null;
  tarifa2VigenciaDesde: string | null;
  tarifa2VigenciaHasta: string | null;
  tarifa3Valor: string | null;
  tarifa3VigenciaDesde: string | null;
  tarifa3VigenciaHasta: string | null;
  tarifa4Valor: string | null;
  tarifa4VigenciaDesde: string | null;
  tarifa4VigenciaHasta: string | null;
  tarifa5Valor: string | null;
  tarifa5VigenciaDesde: string | null;
  tarifa5VigenciaHasta: string | null;
  rentaVariablePct: string | null;
  rentaVariablePisoMinimoUf: string | null;
  rentaVariable2UmbralUf: string | null;
  rentaVariable2Pct: string | null;
  rentaVariable2PisoMinimoUf: string | null;
  rentaVariable3UmbralUf: string | null;
  rentaVariable3Pct: string | null;
  rentaVariable3PisoMinimoUf: string | null;
  pctFondoPromocion: string | null;
  multiplicadorDiciembre: string | null;
  multiplicadorJunio: string | null;
  multiplicadorJulio: string | null;
  multiplicadorAgosto: string | null;
  codigoCC: string | null;
  ggccPctAdministracion: string | null;
  ggccPctReajuste: string | null;
  notas: string | null;
  ggccTipo: GgccTipoInput | null;
  ggccValor: string | null;
  ggccMesesReajuste: number | null;
  anexoFecha: string | null;
  anexoDescripcion: string | null;
};

export type ExistingContractForDiff = {
  numeroContrato: string;
  localCodigo: string;
  arrendatarioNombre: string;
  fechaInicio: string;
  fechaTermino: string;
  fechaEntrega: string | null;
  fechaApertura: string | null;
  pctFondoPromocion: string | null;
  multiplicadorDiciembre: string | null;
  multiplicadorJunio: string | null;
  multiplicadorJulio: string | null;
  multiplicadorAgosto: string | null;
  codigoCC: string | null;
  ggccPctAdministracion: string | null;
  notas: string | null;
  tarifas: Array<{
    tipo: ContractRateType;
    valor: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: string;
    pctAdministracion: string;
    pctReajuste: string | null;
    mesesReajuste: number | null;
  }>;
};

type ParseContractsOptions = {
  fileName?: string;
  existingContratos: Map<string, ExistingContractForDiff>;
  existingLocalData: Map<string, { glam2: string }>;
  existingArrendatarioNombres: Map<string, number>;
};

type RentRollParsedRow = {
  rowNumber: number;
  rawRow: RawRow;
  localCodigo: string;
  arrendatarioNombre: string;
  refCa: string | null;
  fechaInicio: string | null;
  fechaTermino: string | null;
  isVacancy: boolean;
  isSkippedRow: boolean;
};

type BuildPreviewRowsResult = {
  rows: PreviewRow<ContractUploadRow>[];
  matchedByNaturalKeyCount: number;
  creatableContractsCount: number;
  blockedRowsCount: number;
};

const RENT_ROLL_SHEET_NAME = "Rent Roll";
const RENT_ROLL_HEADER_ROW_INDEX = 4;
const RENT_ROLL_DATA_ROW_INDEX = 5;
const RENT_ROLL_SUPPORTED_TYPES = new Set([
  "LOCAL COMERCIAL",
  "MODULO COMERCIAL",
  "BODEGA",
  "MAQUINA EXPENDEDORA",
  "OLA",
  "OTROS"
]);
const RENT_ROLL_SKIPPED_LOCAL_CODES = new Set(["-", "GESTION COMERCIAL - NUEVOS LOCALES"]);
const RENT_ROLL_EMPTY_MARKERS = new Set(["", "-", "N/A", "NA", "NULL"]);

export type ContractPreviewInputRow = {
  rowNumber: number;
  data: Record<string, unknown>;
};

type PreviewSourceRow = {
  rowNumber: number;
  rawRow: RawRow;
};

function emptyPreview(rows: PreviewRow<ContractUploadRow>[], warnings: string[]): UploadPreview<ContractUploadRow> {
  return {
    rows,
    summary: summarize(rows),
    warnings
  };
}

export function buildContractLookupKey(input: {
  numeroContrato?: string | null;
  localCodigo?: string | null;
  arrendatarioNombre?: string | null;
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
    normalizeUploadTenantName(input.arrendatarioNombre ?? ""),
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

export function normalizeUploadTenantName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*->.*$/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocalCode(value: unknown): string {
  return asString(value).toUpperCase();
}

function normalizeRentRollLabel(value: unknown): string {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function isEmptyMarker(value: unknown): boolean {
  return RENT_ROLL_EMPTY_MARKERS.has(normalizeRentRollLabel(value));
}

function normalizeRefCaNumber(value: unknown): string | null {
  const normalized = asString(value).toUpperCase();
  if (!normalized || normalized === "-") {
    return null;
  }
  return normalized;
}

function isEquivalentRefCa(refCa: string | null, numeroContrato: string | null): boolean {
  const left = normalizeRefCaNumber(refCa);
  const right = normalizeRefCaNumber(numeroContrato);
  if (!left || !right) {
    return false;
  }
  return left === right || `C-${left}` === right || left === `C-${right}`;
}

function normalizeRentRollPercent(value: unknown): string | null {
  const normalized = normalizeDecimal(normalizeNullable(value));
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const scaled = parsed !== 0 && Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
  return String(Number(scaled.toFixed(6)));
}

function appendNotePart(parts: string[], label: string, value: unknown): void {
  const normalized = asString(value);
  if (!normalized || normalized === "-") {
    return;
  }
  parts.push(`${label}: ${normalized}`);
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

function emptyRow(): ContractUploadRow {
  return {
    numeroContrato: "",
    localCodigo: "",
    arrendatarioNombre: "",
    fechaInicio: "",
    fechaTermino: "",
    fechaEntrega: null,
    fechaApertura: null,
    tarifaTipo: ContractRateType.FIJO_UF_M2,
    tarifaValor: "",
    tarifaVigenciaDesde: "",
    tarifaVigenciaHasta: null,
    tarifa2Valor: null,
    tarifa2VigenciaDesde: null,
    tarifa2VigenciaHasta: null,
    tarifa3Valor: null,
    tarifa3VigenciaDesde: null,
    tarifa3VigenciaHasta: null,
    tarifa4Valor: null,
    tarifa4VigenciaDesde: null,
    tarifa4VigenciaHasta: null,
    tarifa5Valor: null,
    tarifa5VigenciaDesde: null,
    tarifa5VigenciaHasta: null,
    rentaVariablePct: null,
    rentaVariablePisoMinimoUf: null,
    rentaVariable2UmbralUf: null,
    rentaVariable2Pct: null,
    rentaVariable2PisoMinimoUf: null,
    rentaVariable3UmbralUf: null,
    rentaVariable3Pct: null,
    rentaVariable3PisoMinimoUf: null,
    pctFondoPromocion: null,
    multiplicadorDiciembre: null,
    multiplicadorJunio: null,
    multiplicadorJulio: null,
    multiplicadorAgosto: null,
    codigoCC: null,
    ggccPctAdministracion: null,
    ggccPctReajuste: null,
    notas: null,
    ggccTipo: null,
    ggccValor: null,
    ggccMesesReajuste: null,
    anexoFecha: null,
    anexoDescripcion: null
  };
}

function summarize(rows: PreviewRow<ContractUploadRow>[]): UploadPreview<ContractUploadRow>["summary"] {
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
  row: ContractUploadRow,
  existing: ExistingContractForDiff,
  glam2: string | null
): (keyof ContractUploadRow)[] {
  const changed: (keyof ContractUploadRow)[] = [];

  if (existing.localCodigo.toUpperCase() !== row.localCodigo.toUpperCase()) {
    changed.push("localCodigo");
  }
  if (
    normalizeUploadTenantName(existing.arrendatarioNombre) !==
    normalizeUploadTenantName(row.arrendatarioNombre)
  ) {
    changed.push("arrendatarioNombre");
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
  if (!decimalEquals(existing.multiplicadorJunio, row.multiplicadorJunio)) {
    changed.push("multiplicadorJunio");
  }
  if (!decimalEquals(existing.multiplicadorJulio, row.multiplicadorJulio)) {
    changed.push("multiplicadorJulio");
  }
  if (!decimalEquals(existing.multiplicadorAgosto, row.multiplicadorAgosto)) {
    changed.push("multiplicadorAgosto");
  }
  if ((existing.codigoCC ?? null) !== row.codigoCC) {
    changed.push("codigoCC");
  }
  if ((existing.notas ?? null) !== row.notas) {
    changed.push("notas");
  }

  // Build full upload tarifa list (tramo 1 + escalonada tramos 2-5)
  const uploadTarifas = [
    { tipo: row.tarifaTipo, valor: row.tarifaValor, vigenciaDesde: row.tarifaVigenciaDesde, vigenciaHasta: row.tarifaVigenciaHasta },
    ...[
      { valor: row.tarifa2Valor, desde: row.tarifa2VigenciaDesde, hasta: row.tarifa2VigenciaHasta },
      { valor: row.tarifa3Valor, desde: row.tarifa3VigenciaDesde, hasta: row.tarifa3VigenciaHasta },
      { valor: row.tarifa4Valor, desde: row.tarifa4VigenciaDesde, hasta: row.tarifa4VigenciaHasta },
      { valor: row.tarifa5Valor, desde: row.tarifa5VigenciaDesde, hasta: row.tarifa5VigenciaHasta }
    ]
      .filter((t) => t.valor !== null && t.desde !== null)
      .map((t) => ({ tipo: row.tarifaTipo, valor: t.valor as string, vigenciaDesde: t.desde as string, vigenciaHasta: t.hasta }))
  ];
  if (uploadTarifas.length !== existing.tarifas.filter((t) => t.tipo !== ContractRateType.PORCENTAJE || row.tarifaTipo === ContractRateType.PORCENTAJE).length) {
    changed.push("tarifaValor");
  } else {
    for (const uploadTarifa of uploadTarifas) {
      const existingTarifa = existing.tarifas.find(
        (t) => t.tipo === uploadTarifa.tipo && t.vigenciaDesde === uploadTarifa.vigenciaDesde
      );
      if (!existingTarifa) {
        changed.push("tarifaTipo", "tarifaValor", "tarifaVigenciaDesde");
        break;
      }
      if (!decimalEquals(existingTarifa.valor, uploadTarifa.valor)) {
        changed.push("tarifaValor");
      }
      if ((existingTarifa.vigenciaHasta ?? null) !== uploadTarifa.vigenciaHasta) {
        changed.push("tarifaVigenciaHasta");
      }
    }
  }

  if (row.ggccTipo && row.ggccValor && row.ggccPctAdministracion) {
    const existingGgcc = existing.ggcc[0];
    const storedTarifaBase = toStoredGgccTarifaBaseUfM2(row.ggccTipo, row.ggccValor, glam2);
    if (!existingGgcc || !storedTarifaBase) {
      changed.push(
        "ggccTipo",
        "ggccValor",
        "ggccPctAdministracion",
        "ggccPctReajuste"
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

function buildPreviewRows(
  sourceRows: PreviewSourceRow[],
  options: ParseContractsOptions
): BuildPreviewRowsResult {
  const duplicatedTarifaKey = new Set<string>();
  let matchedByNaturalKeyCount = 0;
  let creatableContractsCount = 0;
  let blockedRowsCount = 0;

  const rows = sourceRows.map(({ rawRow, rowNumber }) => {
    const numeroContrato = asString(rawRow.numerocontrato);
    const localCodigo = asString(rawRow.localcodigo).toUpperCase();
    const arrendatarioNombre = asString(rawRow.arrendatarionombre);
    const arrendatarioNombreLookup = normalizeUploadTenantName(arrendatarioNombre);
    const fechaInicio = parseDate(rawRow.fechainicio);
    const fechaTermino = parseDate(rawRow.fechatermino);
    const fechaEntrega = parseDate(rawRow.fechaentrega);
    const fechaApertura = parseDate(rawRow.fechaapertura);
    const tarifaTipoRaw = asString(rawRow.tarifatipo).toUpperCase();
    const tarifaValor = asString(rawRow.tarifavalor).replace(",", ".");
    const tarifaVigenciaDesde = parseDate(rawRow.tarifavigenciadesde);
    const tarifaVigenciaHasta = parseDate(rawRow.tarifavigenciahasta);
    const tarifa2Valor = normalizeNullable(rawRow.tarifa2valor);
    const tarifa2VigenciaDesde = parseDate(rawRow.tarifa2vigenciadesde);
    const tarifa2VigenciaHasta = parseDate(rawRow.tarifa2vigenciahasta);
    const tarifa3Valor = normalizeNullable(rawRow.tarifa3valor);
    const tarifa3VigenciaDesde = parseDate(rawRow.tarifa3vigenciadesde);
    const tarifa3VigenciaHasta = parseDate(rawRow.tarifa3vigenciahasta);
    const tarifa4Valor = normalizeNullable(rawRow.tarifa4valor);
    const tarifa4VigenciaDesde = parseDate(rawRow.tarifa4vigenciadesde);
    const tarifa4VigenciaHasta = parseDate(rawRow.tarifa4vigenciahasta);
    const tarifa5Valor = normalizeNullable(rawRow.tarifa5valor);
    const tarifa5VigenciaDesde = parseDate(rawRow.tarifa5vigenciadesde);
    const tarifa5VigenciaHasta = parseDate(rawRow.tarifa5vigenciahasta);
    const rentaVariablePct = normalizeNullable(rawRow.rentavariablepct);
    const rentaVariablePisoMinimoUf = normalizeNullable(rawRow.rentavariablepisominimouf);
    const rentaVariable2UmbralUf = normalizeNullable(rawRow.rentavariable2umbraluf);
    const rentaVariable2Pct = normalizeNullable(rawRow.rentavariable2pct);
    const rentaVariable2PisoMinimoUf = normalizeNullable(rawRow.rentavariable2pisominimouf);
    const rentaVariable3UmbralUf = normalizeNullable(rawRow.rentavariable3umbraluf);
    const rentaVariable3Pct = normalizeNullable(rawRow.rentavariable3pct);
    const rentaVariable3PisoMinimoUf = normalizeNullable(rawRow.rentavariable3pisominimouf);
    const pctFondoPromocion = normalizeNullable(rawRow.pctfondopromocion);
    const multiplicadorDiciembre = normalizeNullable(rawRow.multiplicadordiciembre);
    const multiplicadorJunio = normalizeNullable(rawRow.multiplicadorjunio);
    const multiplicadorJulio = normalizeNullable(rawRow.multiplicadorjulio);
    const multiplicadorAgosto = normalizeNullable(rawRow.multiplicadoragosto);
    const codigoCC = normalizeNullable(rawRow.codigocc);
    const ggccPctAdministracion = normalizeNullable(rawRow.ggccpctadministracion);
    const ggccPctReajuste = normalizeNullable(rawRow.ggccpctreajuste);
    const notas = normalizeNullable(rawRow.notas);
    const legacyGgccValue = normalizeNullable(rawRow.ggcctarifabaseufm2);
    const ggccValor = normalizeNullable(rawRow.ggccvalor) ?? legacyGgccValue;
    const ggccTipo = normalizeGgccTipo(rawRow.ggcctipo, Boolean(ggccValor));
    const ggccMesesReajuste = integerOrNull(normalizeNullable(rawRow.ggccmesesreajuste));
    const anexoFecha = parseDate(rawRow.anexofecha);
    const anexoDescripcion = normalizeNullable(rawRow.anexodescripcion);

    const hasAnyRentaVariableValue = Boolean(rentaVariablePct);
    const hasFijoType = Boolean(tarifaTipoRaw && tarifaTipoRaw !== "PORCENTAJE");

    // Si hay tipo fijo explícito → úsalo (aunque también haya rentaVariablePct)
    // Si tipo es PORCENTAJE explícito o solo hay rentaVariablePct → PORCENTAJE
    // Default → FIJO_UF_M2
    const tarifaTipoFinal = (
      hasFijoType ? tarifaTipoRaw
      : tarifaTipoRaw === "PORCENTAJE" || hasAnyRentaVariableValue ? "PORCENTAJE"
      : ContractRateType.FIJO_UF_M2
    ) as ContractRateType;
    const tarifaUsaFechasContrato = tarifaTipoFinal === ContractRateType.PORCENTAJE && !hasFijoType;
    const tarifaValorFinal = (!hasFijoType && hasAnyRentaVariableValue ? rentaVariablePct : tarifaValor) ?? "";
    const tarifaVigenciaDesdeFinal = tarifaUsaFechasContrato ? fechaInicio : tarifaVigenciaDesde;
    const tarifaVigenciaHastaFinal = tarifaUsaFechasContrato ? fechaTermino : tarifaVigenciaHasta;

    const data: ContractUploadRow = {
      numeroContrato,
      localCodigo,
      arrendatarioNombre,
      fechaInicio: fechaInicio ?? "",
      fechaTermino: fechaTermino ?? "",
      fechaEntrega,
      fechaApertura,
      tarifaTipo: tarifaTipoFinal,
      tarifaValor: tarifaValorFinal.replace(",", "."),
      tarifaVigenciaDesde: tarifaVigenciaDesdeFinal ?? "",
      tarifaVigenciaHasta: tarifaVigenciaHastaFinal,
      tarifa2Valor: tarifa2Valor?.replace(",", ".") ?? null,
      tarifa2VigenciaDesde,
      tarifa2VigenciaHasta,
      tarifa3Valor: tarifa3Valor?.replace(",", ".") ?? null,
      tarifa3VigenciaDesde,
      tarifa3VigenciaHasta,
      tarifa4Valor: tarifa4Valor?.replace(",", ".") ?? null,
      tarifa4VigenciaDesde,
      tarifa4VigenciaHasta,
      tarifa5Valor: tarifa5Valor?.replace(",", ".") ?? null,
      tarifa5VigenciaDesde,
      tarifa5VigenciaHasta,
      rentaVariablePct: hasFijoType ? rentaVariablePct : null,
      rentaVariablePisoMinimoUf: hasFijoType ? rentaVariablePisoMinimoUf : null,
      rentaVariable2UmbralUf: hasFijoType ? rentaVariable2UmbralUf : null,
      rentaVariable2Pct: hasFijoType ? rentaVariable2Pct : null,
      rentaVariable2PisoMinimoUf: hasFijoType ? rentaVariable2PisoMinimoUf : null,
      rentaVariable3UmbralUf: hasFijoType ? rentaVariable3UmbralUf : null,
      rentaVariable3Pct: hasFijoType ? rentaVariable3Pct : null,
      rentaVariable3PisoMinimoUf: hasFijoType ? rentaVariable3PisoMinimoUf : null,
      pctFondoPromocion,
      multiplicadorDiciembre,
      multiplicadorJunio,
      multiplicadorJulio,
      multiplicadorAgosto,
      codigoCC,
      ggccPctAdministracion,
      ggccPctReajuste,
      notas,
      ggccTipo,
      ggccValor,
      ggccMesesReajuste,
      anexoFecha,
      anexoDescripcion
    };

    if (!localCodigo || !arrendatarioNombreLookup) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "localCodigo y arrendatarioNombre son obligatorios."
      };
    }
    if (!allowedTipoTarifa.has(data.tarifaTipo)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Tipo de tarifa invalido: ${tarifaTipoRaw}`
      };
    }
    if (!data.fechaInicio || !data.fechaTermino || !data.tarifaVigenciaDesde) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Fechas obligatorias invalidas en contrato o tarifa."
      };
    }
    if (new Date(data.fechaInicio) > new Date(data.fechaTermino)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "fechaInicio no puede ser mayor que fechaTermino."
      };
    }
    if (!data.tarifaValor || Number.isNaN(Number(data.tarifaValor))) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "tarifaValor debe ser numerico."
      };
    }

    // Validate escalonada extra tramos (2-5)
    const extraTramoSpecs = [
      { n: 2, rawValor: tarifa2Valor, rawDesde: normalizeNullable(rawRow.tarifa2vigenciadesde), valor: data.tarifa2Valor, desde: data.tarifa2VigenciaDesde, hasta: data.tarifa2VigenciaHasta },
      { n: 3, rawValor: tarifa3Valor, rawDesde: normalizeNullable(rawRow.tarifa3vigenciadesde), valor: data.tarifa3Valor, desde: data.tarifa3VigenciaDesde, hasta: data.tarifa3VigenciaHasta },
      { n: 4, rawValor: tarifa4Valor, rawDesde: normalizeNullable(rawRow.tarifa4vigenciadesde), valor: data.tarifa4Valor, desde: data.tarifa4VigenciaDesde, hasta: data.tarifa4VigenciaHasta },
      { n: 5, rawValor: tarifa5Valor, rawDesde: normalizeNullable(rawRow.tarifa5vigenciadesde), valor: data.tarifa5Valor, desde: data.tarifa5VigenciaDesde, hasta: data.tarifa5VigenciaHasta }
    ];
    const tramosProvided = extraTramoSpecs.filter((t) => t.rawValor !== null || t.rawDesde !== null);
    if (tramosProvided.length > 0) {
      if (tarifaTipoFinal === ContractRateType.PORCENTAJE) {
        blockedRowsCount += 1;
        return { rowNumber, status: "ERROR", data, errorMessage: "Tarifa escalonada no es compatible con PORCENTAJE." };
      }
      // Tramos must be consecutive: 2, 3, 4, 5 — no gaps
      for (let i = 0; i < tramosProvided.length; i++) {
        if (tramosProvided[i].n !== i + 2) {
          blockedRowsCount += 1;
          return { rowNumber, status: "ERROR", data, errorMessage: `Los tramos deben ser consecutivos. Falta Tarifa ${i + 2}.` };
        }
      }
      let prevHasta: string | null = data.tarifaVigenciaHasta;
      for (const tramo of tramosProvided) {
        if (!prevHasta) {
          blockedRowsCount += 1;
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n - 1} Hasta es obligatorio para tarifa escalonada.` };
        }
        if (!tramo.rawValor) {
          blockedRowsCount += 1;
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n} Valor es obligatorio cuando se informa Tarifa ${tramo.n} Desde.` };
        }
        if (Number.isNaN(Number(tramo.rawValor.replace(",", ".")))) {
          blockedRowsCount += 1;
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n} Valor debe ser numerico.` };
        }
        if (!tramo.rawDesde) {
          blockedRowsCount += 1;
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n} Desde es obligatorio cuando se informa Tarifa ${tramo.n} Valor.` };
        }
        if (!tramo.desde) {
          blockedRowsCount += 1;
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n} Desde tiene fecha invalida.` };
        }
        prevHasta = tramo.hasta;
      }
    }

    if (!isValidDecimalOrNull(data.pctFondoPromocion)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "pctFondoPromocion debe ser numerico cuando se informa."
      };
    }
    if (!isValidDecimalOrNull(data.multiplicadorDiciembre)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "multiplicadorDiciembre debe ser numerico cuando se informa."
      };
    }
    if (!isValidDecimalOrNull(data.multiplicadorJunio)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "multiplicadorJunio debe ser numerico cuando se informa."
      };
    }
    if (!isValidDecimalOrNull(data.multiplicadorJulio)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "multiplicadorJulio debe ser numerico cuando se informa."
      };
    }
    if (!isValidDecimalOrNull(data.multiplicadorAgosto)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "multiplicadorAgosto debe ser numerico cuando se informa."
      };
    }
    if (
      !isValidDecimalOrNull(data.ggccValor) ||
      !isValidDecimalOrNull(data.ggccPctAdministracion) ||
      !isValidDecimalOrNull(data.ggccPctReajuste)
    ) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Campos de GGCC deben ser numericos cuando se informan."
      };
    }
    if (normalizeNullable(rawRow.ggccmesesreajuste) && data.ggccMesesReajuste === null) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "ggccMesesReajuste debe ser un entero mayor o igual a 1."
      };
    }
    if (data.ggccMesesReajuste !== null && !data.ggccPctReajuste) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "ggccPctReajuste es obligatorio cuando se informa ggccMesesReajuste."
      };
    }
    const localData = options.existingLocalData.get(data.localCodigo);
    if (!localData) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Local '${data.localCodigo}' no existe. Sube locales primero.`
      };
    }
    const arrendatarioNombreCount = options.existingArrendatarioNombres.get(arrendatarioNombreLookup) ?? 0;
    if (arrendatarioNombreCount === 0) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Arrendatario '${data.arrendatarioNombre}' no existe. Sube arrendatarios primero.`
      };
    }
    if (arrendatarioNombreCount > 1) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Arrendatario '${data.arrendatarioNombre}' es ambiguo. Debe ser unico en el proyecto.`
      };
    }

    const hasAnyGgccValue = Boolean(
      data.ggccTipo ||
        data.ggccValor ||
        data.ggccPctAdministracion ||
        data.ggccPctReajuste ||
        data.ggccMesesReajuste !== null
    );
    const ggccTarifaBaseUfM2 = toStoredGgccTarifaBaseUfM2(data.ggccTipo, data.ggccValor, localData.glam2);
    const hasCompleteGgcc = Boolean(
      data.ggccTipo &&
        data.ggccValor &&
        data.ggccPctAdministracion &&
        ggccTarifaBaseUfM2
    );
    if (hasAnyGgccValue && !hasCompleteGgcc) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage:
          "GGCC incompleto: si informas GGCC debes incluir ggccTipo, ggccValor y ggccPctAdministracion."
      };
    }
    if (data.ggccTipo === null && normalizeNullable(rawRow.ggcctipo)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "ggccTipo invalido. Usa FIJO_UF_M2 o FIJO_UF."
      };
    }
    if (data.ggccTipo === "FIJO_UF" && !parsePositiveDecimal(localData.glam2)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `El local '${data.localCodigo}' no tiene GLA valida para convertir GGCC FIJO_UF a UF/m2.`
      };
    }

    if ((data.anexoFecha && !data.anexoDescripcion) || (!data.anexoFecha && data.anexoDescripcion)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Anexo incompleto: anexoFecha y anexoDescripcion deben venir juntos."
      };
    }

    const naturalLookupKey = buildContractLookupKey({
      numeroContrato: "",
      localCodigo: data.localCodigo,
      arrendatarioNombre: data.arrendatarioNombre,
      fechaInicio: data.fechaInicio,
      fechaTermino: data.fechaTermino
    });
    const existingByNatural = options.existingContratos.get(naturalLookupKey);
    const existingByNumber = numeroContrato
      ? options.existingContratos.get(
          buildContractLookupKey({
            numeroContrato
          })
        )
      : undefined;
    const existing = existingByNatural ?? existingByNumber;
    if (existingByNatural) {
      matchedByNaturalKeyCount += 1;
    }

    const tariffIdentityKey = existing ? buildContractLookupKey(existing) : naturalLookupKey;
    const tarifaKey = `${tariffIdentityKey}-${data.tarifaTipo}-${data.tarifaVigenciaDesde}`;
    if (duplicatedTarifaKey.has(tarifaKey)) {
      blockedRowsCount += 1;
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Tarifa duplicada en el archivo para numeroContrato + tipo + vigenciaDesde."
      };
    }
    duplicatedTarifaKey.add(tarifaKey);
    if (!existing) {
      creatableContractsCount += 1;
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
    rows,
    matchedByNaturalKeyCount,
    creatableContractsCount,
    blockedRowsCount
  };
}

function toRawRowFromPreviewData(data: Record<string, unknown>): RawRow {
  return {
    numerocontrato: data.numeroContrato ?? "",
    localcodigo: data.localCodigo ?? "",
    arrendatarionombre: data.arrendatarioNombre ?? "",
    fechainicio: data.fechaInicio ?? "",
    fechatermino: data.fechaTermino ?? "",
    fechaentrega: data.fechaEntrega ?? "",
    fechaapertura: data.fechaApertura ?? "",
    tarifatipo: data.tarifaTipo ?? "",
    tarifavalor: data.tarifaValor ?? "",
    tarifavigenciadesde: data.tarifaVigenciaDesde ?? "",
    tarifavigenciahasta: data.tarifaVigenciaHasta ?? "",
    tarifa2valor: data.tarifa2Valor ?? "",
    tarifa2vigenciadesde: data.tarifa2VigenciaDesde ?? "",
    tarifa2vigenciahasta: data.tarifa2VigenciaHasta ?? "",
    tarifa3valor: data.tarifa3Valor ?? "",
    tarifa3vigenciadesde: data.tarifa3VigenciaDesde ?? "",
    tarifa3vigenciahasta: data.tarifa3VigenciaHasta ?? "",
    tarifa4valor: data.tarifa4Valor ?? "",
    tarifa4vigenciadesde: data.tarifa4VigenciaDesde ?? "",
    tarifa4vigenciahasta: data.tarifa4VigenciaHasta ?? "",
    tarifa5valor: data.tarifa5Valor ?? "",
    tarifa5vigenciadesde: data.tarifa5VigenciaDesde ?? "",
    tarifa5vigenciahasta: data.tarifa5VigenciaHasta ?? "",
    rentavariablepct: data.rentaVariablePct ?? "",
    rentavariablepisominimouf: data.rentaVariablePisoMinimoUf ?? "",
    rentavariable2umbraluf: data.rentaVariable2UmbralUf ?? "",
    rentavariable2pct: data.rentaVariable2Pct ?? "",
    rentavariable2pisominimouf: data.rentaVariable2PisoMinimoUf ?? "",
    rentavariable3umbraluf: data.rentaVariable3UmbralUf ?? "",
    rentavariable3pct: data.rentaVariable3Pct ?? "",
    rentavariable3pisominimouf: data.rentaVariable3PisoMinimoUf ?? "",
    pctfondopromocion: data.pctFondoPromocion ?? "",
    multiplicadordiciembre: data.multiplicadorDiciembre ?? "",
    multiplicadorjunio: data.multiplicadorJunio ?? "",
    multiplicadorjulio: data.multiplicadorJulio ?? "",
    multiplicadoragosto: data.multiplicadorAgosto ?? "",
    codigocc: data.codigoCC ?? "",
    ggccpctadministracion: data.ggccPctAdministracion ?? "",
    ggccpctreajuste: data.ggccPctReajuste ?? "",
    notas: data.notas ?? "",
    ggcctipo: data.ggccTipo ?? "",
    ggccvalor: data.ggccValor ?? "",
    ggcctarifabaseufm2: data.ggccTarifaBaseUfM2 ?? "",
    ggccmesesreajuste: data.ggccMesesReajuste ?? "",
    anexofecha: data.anexoFecha ?? "",
    anexodescripcion: data.anexoDescripcion ?? ""
  };
}

function buildExistingNaturalContractMap(
  existingContratos: Map<string, ExistingContractForDiff>
): Map<string, ExistingContractForDiff> {
  const existingByNatural = new Map<string, ExistingContractForDiff>();
  for (const snapshot of existingContratos.values()) {
    existingByNatural.set(
      buildContractLookupKey({
        ...snapshot,
        numeroContrato: ""
      }),
      snapshot
    );
  }
  return existingByNatural;
}

function buildRentRollNotes(row: unknown[]): string | null {
  const parts: string[] = [];
  appendNotePart(parts, "GGCC reajuste", row[14]);
  appendNotePart(parts, "Renta variable", row[16]);
  appendNotePart(parts, "Renta fija", row[18]);
  appendNotePart(parts, "Diciembre", row[20]);
  appendNotePart(parts, "Fondo promocion", row[22]);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function isRentRollSheet(sheet: unknown): boolean {
  if (!sheet) {
    return false;
  }

  const rows = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    range: RENT_ROLL_HEADER_ROW_INDEX
  });
  const header = Array.isArray(rows[0]) ? rows[0] : [];
  return (
    normalizeRentRollLabel(header[1]) === "ID LOCAL" &&
    normalizeRentRollLabel(header[2]).startsWith("NUMERO CONTRATO") &&
    normalizeRentRollLabel(header[4]) === "ARRENDATARIO" &&
    normalizeRentRollLabel(header[6]) === "INICIO" &&
    normalizeRentRollLabel(header[7]) === "TERMINO"
  );
}

function parseRentRollRows(sheet: unknown): RentRollParsedRow[] {
  const rows = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    cellDates: true,
    defval: null,
    range: RENT_ROLL_HEADER_ROW_INDEX
  });

  return rows
    .slice(1)
    .filter((row) => Array.isArray(row) && row.some((cell) => cell !== null && cell !== ""))
    .map((row, index) => {
      const localCodigo = normalizeLocalCode(row[1]);
      const arrendatarioNombre = asString(row[4]);
      const tipo = normalizeRentRollLabel(row[3]);
      const fechaInicio = parseDate(row[6]);
      const fechaTermino = parseDate(row[7]);
      const rentaFija = normalizeDecimal(normalizeNullable(row[17]));
      const rentaVariablePct = normalizeRentRollPercent(row[15]);
      const ggccValor = normalizeDecimal(normalizeNullable(row[10]));
      const ggccPctAdministracion = normalizeRentRollPercent(row[9]);
      const ggccPctReajuste = normalizeRentRollPercent(row[11]);
      const pctFondoPromocion = normalizeRentRollPercent(row[21]);
      const multiplicadorDiciembre = normalizeDecimal(normalizeNullable(row[19]));
      const ggccMesesReajusteRaw = isEmptyMarker(row[12]) ? null : asString(row[12]);
      const isVacancy = normalizeRentRollLabel(arrendatarioNombre).includes("VACANTE");
      const isSkippedRow =
        !localCodigo ||
        RENT_ROLL_SKIPPED_LOCAL_CODES.has(normalizeRentRollLabel(localCodigo)) ||
        !RENT_ROLL_SUPPORTED_TYPES.has(tipo);
      const tarifaTipo =
        rentaFija !== null ? ContractRateType.FIJO_UF_M2 : rentaVariablePct ? ContractRateType.PORCENTAJE : "";

      return {
        rowNumber: RENT_ROLL_DATA_ROW_INDEX + index + 1,
        localCodigo,
        arrendatarioNombre,
        refCa: normalizeRefCaNumber(row[2]),
        fechaInicio,
        fechaTermino,
        isVacancy,
        isSkippedRow,
        rawRow: {
          numerocontrato: "",
          localcodigo: localCodigo,
          arrendatarionombre: arrendatarioNombre,
          fechainicio: fechaInicio ?? "",
          fechatermino: fechaTermino ?? "",
          fechaentrega: "",
          fechaapertura: "",
          tarifatipo: tarifaTipo,
          tarifavalor: rentaFija ?? rentaVariablePct ?? "",
          tarifavigenciadesde: fechaInicio ?? "",
          tarifavigenciahasta: tarifaTipo === ContractRateType.FIJO_UF_M2 ? fechaTermino ?? "" : "",
          tarifa2valor: "",
          tarifa2vigenciadesde: "",
          tarifa2vigenciahasta: "",
          tarifa3valor: "",
          tarifa3vigenciadesde: "",
          tarifa3vigenciahasta: "",
          tarifa4valor: "",
          tarifa4vigenciadesde: "",
          tarifa4vigenciahasta: "",
          tarifa5valor: "",
          tarifa5vigenciadesde: "",
          tarifa5vigenciahasta: "",
          rentavariablepct: tarifaTipo === ContractRateType.FIJO_UF_M2 ? rentaVariablePct ?? "" : "",
          rentavariablepisominimouf: "",
          rentavariable2umbraluf: "",
          rentavariable2pct: "",
          rentavariable2pisominimouf: "",
          rentavariable3umbraluf: "",
          rentavariable3pct: "",
          rentavariable3pisominimouf: "",
          pctfondopromocion: pctFondoPromocion ?? "",
          multiplicadordiciembre: multiplicadorDiciembre ?? "",
          multiplicadorjunio: "",
          multiplicadorjulio: "",
          multiplicadoragosto: "",
          codigocc: "",
          ggccpctadministracion: ggccPctAdministracion ?? "",
          ggccpctreajuste: ggccPctReajuste ?? "",
          notas: buildRentRollNotes(row) ?? "",
          ggcctipo: ggccValor ? "FIJO_UF_M2" : "",
          ggccvalor: ggccValor ?? "",
          ggccmesesreajuste: ggccMesesReajusteRaw ?? "",
          anexofecha: "",
          anexodescripcion: ""
        }
      };
    });
}

function parseTemplateContractsWorkbook(
  workbook: ReturnType<typeof read>,
  options: ParseContractsOptions,
  warnings: string[]
): UploadPreview<ContractUploadRow> {
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    const rows: PreviewRow<ContractUploadRow>[] = [
      { rowNumber: 0, status: "ERROR", data: emptyRow(), errorMessage: "El archivo no contiene hojas." }
    ];
    return emptyPreview(rows, warnings);
  }

  const rawRows = utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], {
    defval: "",
    raw: false,
    range: 2
  });
  const normalizedRows = rawRows.map((row) => normalizeHeaders(row));

  if (normalizedRows.length > MAX_ROWS) {
    const rows: PreviewRow<ContractUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: `El archivo supera el maximo de ${MAX_ROWS} filas.`
      }
    ];
    return emptyPreview(rows, warnings);
  }

  const headers = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    const rows: PreviewRow<ContractUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: `Faltan columnas requeridas: ${missing.join(", ")}`
      }
    ];
    return emptyPreview(rows, warnings);
  }

  const sourceRows: PreviewSourceRow[] = normalizedRows.map((rawRow, index) => ({
    rowNumber: index + 2,
    rawRow
  }));
  const preview = buildPreviewRows(sourceRows, options);

  return {
    rows: preview.rows,
    summary: summarize(preview.rows),
    warnings,
    sourceFormat: "template"
  };
}

function parseRentRollContractsWorkbook(
  workbook: ReturnType<typeof read>,
  options: ParseContractsOptions,
  warnings: string[]
): UploadPreview<ContractUploadRow> {
  const rentRollSheet =
    workbook.Sheets[RENT_ROLL_SHEET_NAME] ??
    workbook.Sheets[workbook.SheetNames.find((name) => isRentRollSheet(workbook.Sheets[name])) ?? ""];

  if (!rentRollSheet || !isRentRollSheet(rentRollSheet)) {
    const rows: PreviewRow<ContractUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: "No se encontro una hoja 'Rent Roll' valida en el archivo."
      }
    ];
    return emptyPreview(rows, warnings);
  }

  const parsedRows = parseRentRollRows(rentRollSheet);
  const contractSourceRows = parsedRows
    .filter((row) => !row.isVacancy && !row.isSkippedRow)
    .map<PreviewSourceRow>((row) => ({
      rowNumber: row.rowNumber,
      rawRow: row.rawRow
    }));

  const preview = buildPreviewRows(contractSourceRows, options);
  const previewByRowNumber = new Map(preview.rows.map((row) => [row.rowNumber, row]));
  const existingByNatural = buildExistingNaturalContractMap(options.existingContratos);
  const today = new Date().toISOString().slice(0, 10);
  const activeContractsByLocal = new Map<string, ExistingContractForDiff[]>();

  for (const snapshot of existingByNatural.values()) {
    if (snapshot.fechaInicio <= today && snapshot.fechaTermino >= today) {
      const existing = activeContractsByLocal.get(snapshot.localCodigo) ?? [];
      existing.push(snapshot);
      activeContractsByLocal.set(snapshot.localCodigo, existing);
    }
  }

  const reconciliationItems: ContractReconciliationItem[] = [];
  let vacancyConfirmed = 0;
  let vacancyConflicts = 0;
  let refCaMismatches = 0;
  let skippedRows = 0;

  for (const row of parsedRows) {
    if (row.isSkippedRow) {
      skippedRows += 1;
      reconciliationItems.push({
        rowNumber: row.rowNumber,
        kind: "skipped_row",
        localCodigo: row.localCodigo || null,
        arrendatarioNombre: row.arrendatarioNombre || null,
        refCa: row.refCa,
        message: "Fila omitida por no representar un contrato cargable del Rent Roll."
      });
      continue;
    }

    if (row.isVacancy) {
      const activeContracts = activeContractsByLocal.get(row.localCodigo) ?? [];
      const kind = activeContracts.length > 0 ? "vacancy_conflict" : "vacancy_confirmed";
      if (kind === "vacancy_conflict") {
        vacancyConflicts += 1;
      } else {
        vacancyConfirmed += 1;
      }
      reconciliationItems.push({
        rowNumber: row.rowNumber,
        kind,
        localCodigo: row.localCodigo || null,
        arrendatarioNombre: row.arrendatarioNombre || null,
        refCa: row.refCa,
        message:
          kind === "vacancy_conflict"
            ? "El Rent Roll marca VACANTE pero existe un contrato activo para ese local en la base."
            : "El Rent Roll marca VACANTE y no se detecto contrato activo para ese local."
      });
      continue;
    }

    const previewRow = previewByRowNumber.get(row.rowNumber);
    if (!previewRow) {
      continue;
    }

    const naturalKey =
      row.fechaInicio && row.fechaTermino
        ? buildContractLookupKey({
            numeroContrato: "",
            localCodigo: row.localCodigo,
            arrendatarioNombre: row.arrendatarioNombre,
            fechaInicio: row.fechaInicio,
            fechaTermino: row.fechaTermino
          })
        : null;
    const existingByNaturalKey = naturalKey ? existingByNatural.get(naturalKey) : undefined;

    if (previewRow.status === "NEW") {
      reconciliationItems.push({
        rowNumber: row.rowNumber,
        kind: "creatable_contract",
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre,
        refCa: row.refCa,
        message: "Fila valida sin contrato existente por clave natural; se puede crear."
      });
    }

    if (previewRow.status === "ERROR") {
      reconciliationItems.push({
        rowNumber: row.rowNumber,
        kind: "blocked_row",
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre,
        refCa: row.refCa,
        message: previewRow.errorMessage ?? "Fila bloqueada durante la reconciliacion."
      });
    }

    if (existingByNaturalKey && row.refCa && !isEquivalentRefCa(row.refCa, existingByNaturalKey.numeroContrato)) {
      refCaMismatches += 1;
      reconciliationItems.push({
        rowNumber: row.rowNumber,
        kind: "ref_ca_mismatch",
        localCodigo: row.localCodigo,
        arrendatarioNombre: row.arrendatarioNombre,
        refCa: row.refCa,
        message: `REF CA '${row.refCa}' no coincide con numeroContrato actual '${existingByNaturalKey.numeroContrato}'.`
      });
    }
  }

  const reconciliation: ContractReconciliation = {
    summary: {
      matchedByNaturalKey: preview.matchedByNaturalKeyCount,
      creatableContracts: preview.creatableContractsCount,
      vacancyConfirmed,
      vacancyConflicts,
      blockedRows: preview.blockedRowsCount,
      refCaMismatches,
      skippedRows
    },
    items: reconciliationItems
  };

  return {
    rows: preview.rows,
    summary: summarize(preview.rows),
    warnings,
    sourceFormat: "rent_roll",
    reconciliation
  };
}

export function revalidateContractPreviewRows(
  rows: ContractPreviewInputRow[],
  options: ParseContractsOptions
): UploadPreview<ContractUploadRow> {
  const sourceRows: PreviewSourceRow[] = rows.map((row) => ({
    rowNumber: row.rowNumber,
    rawRow: toRawRowFromPreviewData(row.data)
  }));

  const preview = buildPreviewRows(sourceRows, options);
  return {
    rows: preview.rows,
    summary: summarize(preview.rows),
    warnings: [],
    sourceFormat: "template"
  };
}

export function parseContractsFile(
  buffer: ArrayBuffer,
  options: ParseContractsOptions
): UploadPreview<ContractUploadRow> {
  const warnings: string[] = [];
  const workbook = read(Buffer.from(buffer), { type: "buffer", raw: true, cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  const rentRollSheetName = workbook.SheetNames.find((sheetName) =>
    isRentRollSheet(workbook.Sheets[sheetName])
  );
  if (!firstSheet) {
    const rows: PreviewRow<ContractUploadRow>[] = [
      { rowNumber: 0, status: "ERROR", data: emptyRow(), errorMessage: "El archivo no contiene hojas." }
    ];
    return emptyPreview(rows, warnings);
  }

  if (options.fileName && !/\.(csv|xlsx|xls)$/i.test(options.fileName)) {
    warnings.push("Formato no estandar detectado. Se intento procesar igualmente.");
  }
  if (rentRollSheetName) {
    warnings.push("Se detecto formato Rent Roll; la reconciliacion usa clave natural y REF CA solo informativo.");
    return parseRentRollContractsWorkbook(workbook, options, warnings);
  }

  return parseTemplateContractsWorkbook(workbook, options, warnings);
}

export function buildErrorCsv(issues: UploadIssue[]): string {
  const header = "rowNumber,message";
  const lines = issues.map((issue) => `${issue.rowNumber},\"${issue.message.replaceAll("\"", "\"\"")}\"`);
  return [header, ...lines].join("\n");
}
