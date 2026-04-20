import { ContractRateType } from "@prisma/client";
import { read, utils } from "xlsx";
import { MAX_ROWS, normalizeHeaders, parseDate } from "@/lib/upload/parse-utils";
import type { PreviewRow, UploadIssue, UploadPreview } from "@/types/upload";

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

export type ContractPreviewInputRow = {
  rowNumber: number;
  data: Record<string, unknown>;
};

type PreviewSourceRow = {
  rowNumber: number;
  rawRow: RawRow;
};

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
    .toLowerCase()
    .replace(/\s+/g, " ");
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
): PreviewRow<ContractUploadRow>[] {
  const duplicatedTarifaKey = new Set<string>();

  return sourceRows.map(({ rawRow, rowNumber }) => {
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
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "localCodigo y arrendatarioNombre son obligatorios."
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
        return { rowNumber, status: "ERROR", data, errorMessage: "Tarifa escalonada no es compatible con PORCENTAJE." };
      }
      // Tramos must be consecutive: 2, 3, 4, 5 — no gaps
      for (let i = 0; i < tramosProvided.length; i++) {
        if (tramosProvided[i].n !== i + 2) {
          return { rowNumber, status: "ERROR", data, errorMessage: `Los tramos deben ser consecutivos. Falta Tarifa ${i + 2}.` };
        }
      }
      let prevHasta: string | null = data.tarifaVigenciaHasta;
      for (const tramo of tramosProvided) {
        if (!prevHasta) {
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n - 1} Hasta es obligatorio para tarifa escalonada.` };
        }
        if (!tramo.rawValor) {
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n} Valor es obligatorio cuando se informa Tarifa ${tramo.n} Desde.` };
        }
        if (Number.isNaN(Number(tramo.rawValor.replace(",", ".")))) {
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n} Valor debe ser numerico.` };
        }
        if (!tramo.rawDesde) {
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n} Desde es obligatorio cuando se informa Tarifa ${tramo.n} Valor.` };
        }
        if (!tramo.desde) {
          return { rowNumber, status: "ERROR", data, errorMessage: `Tarifa ${tramo.n} Desde tiene fecha invalida.` };
        }
        prevHasta = tramo.hasta;
      }
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
    if (!isValidDecimalOrNull(data.multiplicadorJunio)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "multiplicadorJunio debe ser numerico cuando se informa."
      };
    }
    if (!isValidDecimalOrNull(data.multiplicadorJulio)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "multiplicadorJulio debe ser numerico cuando se informa."
      };
    }
    if (!isValidDecimalOrNull(data.multiplicadorAgosto)) {
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
    const localData = options.existingLocalData.get(data.localCodigo);
    if (!localData) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Local '${data.localCodigo}' no existe. Sube locales primero.`
      };
    }
    const arrendatarioNombreCount = options.existingArrendatarioNombres.get(arrendatarioNombreLookup) ?? 0;
    if (arrendatarioNombreCount === 0) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: `Arrendatario '${data.arrendatarioNombre}' no existe. Sube arrendatarios primero.`
      };
    }
    if (arrendatarioNombreCount > 1) {
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
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage:
          "GGCC incompleto: si informas GGCC debes incluir ggccTipo, ggccValor y ggccPctAdministracion."
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

    const contractLookupKey = buildContractLookupKey({
      numeroContrato,
      localCodigo: data.localCodigo,
      arrendatarioNombre: data.arrendatarioNombre,
      fechaInicio: data.fechaInicio,
      fechaTermino: data.fechaTermino
    });
    const tarifaKey = `${contractLookupKey}-${data.tarifaTipo}-${data.tarifaVigenciaDesde}`;
    if (duplicatedTarifaKey.has(tarifaKey)) {
      return {
        rowNumber,
        status: "ERROR",
        data,
        errorMessage: "Tarifa duplicada en el archivo para numeroContrato + tipo + vigenciaDesde."
      };
    }
    duplicatedTarifaKey.add(tarifaKey);

    const existing = options.existingContratos.get(contractLookupKey);
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

export function revalidateContractPreviewRows(
  rows: ContractPreviewInputRow[],
  options: ParseContractsOptions
): UploadPreview<ContractUploadRow> {
  const sourceRows: PreviewSourceRow[] = rows.map((row) => ({
    rowNumber: row.rowNumber,
    rawRow: toRawRowFromPreviewData(row.data)
  }));

  const previewRows = buildPreviewRows(sourceRows, options);
  return {
    rows: previewRows,
    summary: summarize(previewRows),
    warnings: []
  };
}

export function parseContractsFile(
  buffer: ArrayBuffer,
  options: ParseContractsOptions
): UploadPreview<ContractUploadRow> {
  const workbook = read(Buffer.from(buffer), { type: "buffer", raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    const rows: PreviewRow<ContractUploadRow>[] = [
      { rowNumber: 0, status: "ERROR", data: emptyRow(), errorMessage: "El archivo no contiene hojas." }
    ];
    return { rows, summary: summarize(rows), warnings: [] };
  }

  const rawRows = utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheet], {
    defval: "",
    raw: false,
    range: 2
  });
  const normalizedRows = rawRows.map((row) => normalizeHeaders(row));
  const warnings: string[] = [];

  if (options.fileName && !/\.(csv|xlsx|xls)$/i.test(options.fileName)) {
    warnings.push("Formato no estandar detectado. Se intento procesar igualmente.");
  }

  if (normalizedRows.length > MAX_ROWS) {
    const rows: PreviewRow<ContractUploadRow>[] = [
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
    const rows: PreviewRow<ContractUploadRow>[] = [
      {
        rowNumber: 0,
        status: "ERROR",
        data: emptyRow(),
        errorMessage: `Faltan columnas requeridas: ${missing.join(", ")}`
      }
    ];
    return { rows, summary: summarize(rows), warnings };
  }

  const sourceRows: PreviewSourceRow[] = normalizedRows.map((rawRow, index) => ({
    rowNumber: index + 2,
    rawRow
  }));
  const previewRows = buildPreviewRows(sourceRows, options);

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
