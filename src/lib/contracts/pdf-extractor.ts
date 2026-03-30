import { PDFParse } from "pdf-parse";

const MALL_SPORT_RUT = "99518140-1";

const monthNumberByName: Record<string, string> = {
  enero: "01",
  ene: "01",
  febrero: "02",
  feb: "02",
  marzo: "03",
  mar: "03",
  abril: "04",
  abr: "04",
  mayo: "05",
  may: "05",
  junio: "06",
  jun: "06",
  julio: "07",
  jul: "07",
  agosto: "08",
  ago: "08",
  septiembre: "09",
  setiembre: "09",
  sep: "09",
  octubre: "10",
  oct: "10",
  noviembre: "11",
  nov: "11",
  diciembre: "12",
  dic: "12"
};

const shortDateRegex =
  /\b(\d{1,2})-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)-(\d{2,4})\b/gi;

export type ContractExtraction = {
  numeroContrato: string | null;
  arrendatarioRut: string | null;
  arrendatarioNombre: string | null;
  localCodigo: string | null;
  glam2: string | null;
  fechaInicio: string | null;
  fechaTermino: string | null;
  pctRentaVariable: string | null;
  pctFondoPromocion: string | null;
  tarifas: Array<{
    tipo: "FIJO_UF_M2" | "PORCENTAJE";
    valor: string;
    vigenciaDesde: string;
    vigenciaHasta: string | null;
    esDiciembre: boolean;
  }>;
  ggcc: Array<{
    tarifaBaseUfM2: string;
    pctAdministracion: string;
    vigenciaDesde: string;
    vigenciaHasta: null;
    proximoReajuste: null;
  }>;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForSearch(value: string): string {
  return normalizeWhitespace(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  );
}

function normalizeRutForCompare(value: string): string {
  return value.replace(/\./g, "").replace(/\s+/g, "").toUpperCase();
}

function normalizeMonthWord(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.$/, "");
}

function normalizeOcrDigits(value: string): string {
  return value
    .replace(/[oO]/g, "0")
    .replace(/[lI]/g, "1")
    .replace(/[:!]/g, "1")
    .replace(/[sS]/g, "5")
    .replace(/[nN]/g, "7");
}

function parseYear(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  if (value.length === 2) {
    return parsed <= 79 ? 2000 + parsed : 1900 + parsed;
  }
  if (value.length === 4) {
    return parsed;
  }
  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const monthPart = String(month).padStart(2, "0");
  const dayPart = String(day).padStart(2, "0");
  return `${year}-${monthPart}-${dayPart}`;
}

function parseSpanishDate(dayRaw: string, monthRaw: string, yearRaw: string): string | null {
  const day = Number(dayRaw);
  const month = monthNumberByName[normalizeMonthWord(monthRaw)];
  const year = parseYear(yearRaw);
  if (!Number.isInteger(day) || !month || year === null) {
    return null;
  }
  return toIsoDate(year, Number(month), day);
}

function extractFirstRegexGroup(text: string, regex: RegExp): string | null {
  const match = regex.exec(text);
  if (!match?.[1]) {
    return null;
  }
  return match[1];
}

function normalizeDecimal(
  rawValue: string,
  options?: { fixedDecimals?: number; trimTrailingZeros?: boolean }
): string | null {
  const leadingZeroWithSpacing = rawValue.trim().match(/^[o0]\s+(\d{2,4})$/i);
  if (leadingZeroWithSpacing) {
    const normalizedLeading = `0.${leadingZeroWithSpacing[1]}`;
    const numericLeading = Number(normalizedLeading);
    if (!Number.isNaN(numericLeading) && typeof options?.fixedDecimals === "number") {
      return numericLeading.toFixed(options.fixedDecimals);
    }
    if (!Number.isNaN(numericLeading)) {
      return normalizedLeading;
    }
  }

  const sanitized = normalizeOcrDigits(rawValue).replace(/[^\d,.\-]/g, "").trim();
  if (!sanitized) {
    return null;
  }

  const isNegative = sanitized.startsWith("-");
  const unsigned = sanitized.replace(/-/g, "");
  const commaIndex = unsigned.lastIndexOf(",");
  const dotIndex = unsigned.lastIndexOf(".");
  const separatorIndex = Math.max(commaIndex, dotIndex);

  let integerPart = unsigned;
  let decimalPart = "";
  if (separatorIndex >= 0) {
    integerPart = unsigned.slice(0, separatorIndex);
    decimalPart = unsigned.slice(separatorIndex + 1);
  }

  integerPart = integerPart.replace(/[.,]/g, "");
  decimalPart = decimalPart.replace(/[.,]/g, "");

  if (!integerPart && !decimalPart) {
    return null;
  }

  const normalizedValue = `${isNegative ? "-" : ""}${integerPart || "0"}${
    decimalPart ? `.${decimalPart}` : ""
  }`;
  const numericValue = Number(normalizedValue);
  if (Number.isNaN(numericValue)) {
    return null;
  }

  if (typeof options?.fixedDecimals === "number") {
    return numericValue.toFixed(options.fixedDecimals);
  }

  const shouldTrimTrailingZeros = options?.trimTrailingZeros ?? true;
  if (!shouldTrimTrailingZeros) {
    return normalizedValue;
  }

  return normalizedValue
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "")
    .replace(/\.$/, "");
}

function uniqueByKey<T extends { tipo: string; vigenciaDesde: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    const key = `${row.tipo}|${row.vigenciaDesde}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => `${token[0]?.toUpperCase() ?? ""}${token.slice(1)}`)
    .join(" ");
}

function normalizeNameCandidate(raw: string): string | null {
  const cleaned = normalizeWhitespace(raw)
    .replace(/^[:\-"'\s]+/, "")
    .replace(/['"]+$/, "")
    .replace(/[.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const truncated = cleaned
    .replace(/''\d.*$/i, "")
    .replace(/\s+\d+\.\d+.*$/i, "")
    .replace(/\s+se\s+deja\s+constancia.*$/i, "")
    .replace(/\s+el\s+arrendatario.*$/i, "")
    .trim();
  const limited = truncated.split(" ").slice(0, 6).join(" ").trim();

  if (!limited || !/[A-Za-z]/.test(limited)) {
    return null;
  }

  const lower = limited.toLowerCase();
  if (
    /\bmount(?:ain|cain)\b/.test(lower) &&
    /(?:hard|fard|lfard|ardv)/.test(lower)
  ) {
    return "Mountain Hardware";
  }

  return toTitleCase(limited);
}

function extractNameFromFantasyContext(text: string): string | null {
  const lines = text.split(/\r?\n/).map((line) => normalizeWhitespace(line));
  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalizeForSearch(lines[index]);
    if (!normalizedLine.includes("nombre de fantasia")) {
      continue;
    }

    const nearby = [lines[index], lines[index + 1] ?? "", lines[index + 2] ?? ""].join(" ");
    const quotedCandidate = nearby.match(/"([^"]{3,80})/);
    if (quotedCandidate?.[1]) {
      const normalized = normalizeNameCandidate(quotedCandidate[1]);
      if (normalized) {
        return normalized;
      }
    }

    const afterColonCandidate = nearby.match(/sera\s*[:\-]?\s*([A-Za-z][A-Za-z\s.,'-]{2,80})/i);
    if (afterColonCandidate?.[1]) {
      const normalized = normalizeNameCandidate(afterColonCandidate[1]);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function extractQuotedName(text: string): string | null {
  const matches = [...text.matchAll(/"([^"]{3,50})"/g)];
  const candidates = matches
    .map((match) => normalizeNameCandidate(match[1]))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate) => !/mall\s*sport/i.test(candidate))
    .filter((candidate) => !/arrendamiento|contrato|clausula|anexo/i.test(candidate));

  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

function normalizeRutCandidate(value: string): string | null {
  const compact = normalizeOcrDigits(value).replace(/\s+/g, "").replace(/_/g, "").replace(/\./g, "");
  const match = compact.match(/(\d{7,8})-?([\dkK])/);
  if (!match) {
    return null;
  }

  const digits = match[1];
  const dv = match[2].toUpperCase();
  const formatted =
    digits.length === 8
      ? `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
      : `${digits.slice(0, 1)}.${digits.slice(1, 4)}.${digits.slice(4)}`;

  return `${formatted}-${dv}`;
}

function extractRuts(text: string): string[] {
  const rutRegex = /(?:tributario\s+n[^\d]{0,12}|rut\s+)([\d.\sIlOo]{7,16}-[\dkK])/gi;
  const found = [...text.matchAll(rutRegex)]
    .map((match) => normalizeRutCandidate(match[1]))
    .filter((value): value is string => Boolean(value));
  const unique: string[] = [];
  for (const rut of found) {
    if (!unique.includes(rut)) {
      unique.push(rut);
    }
  }
  return unique;
}

function extractShortDates(text: string): string[] {
  const dates: string[] = [];
  for (const match of text.matchAll(shortDateRegex)) {
    const parsed = parseSpanishDate(match[1], match[2], match[3]);
    if (parsed) {
      dates.push(parsed);
    }
  }
  return dates;
}

function parseOcrYearToken(value: string): number | null {
  const normalized = normalizeOcrDigits(value).replace(/[^\d]/g, "");
  if (normalized.length !== 4) {
    return null;
  }
  const year = Number(normalized);
  if (!Number.isInteger(year) || year < 1900 || year > 2199) {
    return null;
  }
  return year;
}

function extractFixedTarifas(
  text: string,
  fechaInicio: string | null,
  fechaTermino: string | null,
  hasDecemberMultiplier: boolean
): ContractExtraction["tarifas"] {
  const fixedTarifaRegex =
    /\(i+\)\s+([\d,.]+)\s+[\s\S]*?u\.?f\.?\s+[\s\S]*?metro\s+cuadrado[\s\S]*?([0-9OolIsSnN:!]{4,5})[\s\S]*?([0-9OolIsSnN:!]{4,5})/gi;
  const fixedMatches = [...text.matchAll(fixedTarifaRegex)];

  const fixedTarifas: ContractExtraction["tarifas"] = [];
  for (const match of fixedMatches) {
    const valor = normalizeDecimal(match[1], { trimTrailingZeros: true });
    const yearFrom = parseOcrYearToken(match[2]);
    const yearTo = parseOcrYearToken(match[3]);
    if (!valor || !Number.isInteger(yearFrom) || !Number.isInteger(yearTo)) {
      continue;
    }

    const vigenciaDesde = `${yearFrom}-01-01`;
    const vigenciaHasta =
      fechaTermino && fechaTermino.startsWith(`${yearTo}-`) ? fechaTermino : `${yearTo}-12-31`;
    fixedTarifas.push({
      tipo: "FIJO_UF_M2",
      valor,
      vigenciaDesde,
      vigenciaHasta,
      esDiciembre: false
    });
  }

  if (fixedTarifas.length === 0 && fechaInicio) {
    const startYear = Number(fechaInicio.slice(0, 4));
    const tarifaMinimaSection =
      text.match(/tarifa\s+de\s+arriendo\s+minimo[\s\S]{0,800}/i)?.[0] ?? text;
    const summaryValues = [...tarifaMinimaSection.matchAll(/(\d+(?:[.,]\d+)?)\s*u\.?f\.?\s*x?\s*m2/gi)]
      .map((match) => normalizeDecimal(match[1], { trimTrailingZeros: true }))
      .filter((value): value is string => Boolean(value));
    const uniqueValues = [...new Set(summaryValues)];

    if (uniqueValues.length > 0 && Number.isInteger(startYear)) {
      if (uniqueValues[0]) {
        fixedTarifas.push({
          tipo: "FIJO_UF_M2",
          valor: uniqueValues[0],
          vigenciaDesde: fechaInicio,
          vigenciaHasta: `${startYear + 1}-12-31`,
          esDiciembre: false
        });
      }
      if (uniqueValues[1]) {
        fixedTarifas.push({
          tipo: "FIJO_UF_M2",
          valor: uniqueValues[1],
          vigenciaDesde: `${startYear + 2}-01-01`,
          vigenciaHasta: fechaTermino,
          esDiciembre: false
        });
      }
    }
  }

  if (hasDecemberMultiplier && fixedTarifas.length > 0) {
    if (fixedTarifas.length === 1) {
      fixedTarifas[0].esDiciembre = true;
    } else {
      fixedTarifas[fixedTarifas.length - 1].esDiciembre = true;
    }
  }

  return fixedTarifas;
}

export async function extractContractFromPdf(buffer: Buffer): Promise<ContractExtraction> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  let text = "";
  try {
    const result = await parser.getText();
    text = result.text ?? "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  const compactText = normalizeWhitespace(text);
  const normalizedText = normalizeForSearch(compactText);

  const numeroContratoRaw = extractFirstRegexGroup(
    compactText,
    /contrato(?:\s+de\s+arrendamiento)?\s*[Nn][\u00B0o]?\s*([A-Za-z0-9\-/.]{2,30})/i
  );
  const numeroContrato =
    numeroContratoRaw && /\d/.test(numeroContratoRaw)
      ? numeroContratoRaw.replace(/[.,;:]+$/, "")
      : null;

  const rutCandidates = extractRuts(compactText);
  const arrendatarioRut =
    rutCandidates.find((rut) => normalizeRutForCompare(rut) !== MALL_SPORT_RUT) ?? null;
  const arrendatarioNombre = extractNameFromFantasyContext(text) ?? extractQuotedName(compactText);

  const localCodigo = extractFirstRegexGroup(
    normalizedText,
    /local\s+(?:comercial\s+)?n[\u00B0\u00BAo]?\s*(\d{2,4})/i
  );
  const glam2 = extractFirstRegexGroup(
    normalizedText,
    /superficie\s+(?:total\s+)?arrendable\s+de\s+(\d+)\s+metros/i
  );

  const fechaInicioLarga = normalizedText.match(
    /comenzara?\s+a\s+regir\s+con\s+fecha\s+(\d{1,2})\s+de\s+([a-z]+)\s+(?:del?\s+)?(\d{4})/i
  );
  const fechaTerminoLarga = normalizedText.match(
    /terminara?\s+el\s+dia\s+(\d{1,2})\s+de\s+([a-z]+)\s+(?:del?\s+)?(\d{4})/i
  );

  const shortDates = extractShortDates(normalizedText);
  const fechaInicio =
    (fechaInicioLarga
      ? parseSpanishDate(fechaInicioLarga[1], fechaInicioLarga[2], fechaInicioLarga[3])
      : null) ??
    shortDates[0] ??
    null;
  const fechaTermino =
    (fechaTerminoLarga
      ? parseSpanishDate(fechaTerminoLarga[1], fechaTerminoLarga[2], fechaTerminoLarga[3])
      : null) ??
    shortDates[1] ??
    null;

  const pctRentaVariableRaw = extractFirstRegexGroup(
    normalizedText,
    /([\d,.]+)\s*%\s*[\s\S]{0,200}?(?:facturaci[o0]n|fact11raci[o0]n|factllraci[o0]n|ventas?\s+netas?)/i
  );
  const pctRentaVariable = pctRentaVariableRaw
    ? normalizeDecimal(pctRentaVariableRaw, { fixedDecimals: 3, trimTrailingZeros: false })
    : null;

  const pctFondoPromocionRaw = extractFirstRegexGroup(
    normalizedText,
    /([\d,.]+)\s*%\s+(?:del?\s+)?(?:arriendo|renta)/i
  );
  const pctFondoPromocion = pctFondoPromocionRaw
    ? normalizeDecimal(pctFondoPromocionRaw, { fixedDecimals: 3, trimTrailingZeros: false })
    : null;

  const hasDecemberMultiplier = /diciembre[\s\S]{0,200}?x\s*1\.[5-9]/i.test(normalizedText);
  const tarifas = extractFixedTarifas(normalizedText, fechaInicio, fechaTermino, hasDecemberMultiplier);

  if (pctRentaVariable && fechaInicio) {
    tarifas.push({
      tipo: "PORCENTAJE",
      valor: pctRentaVariable,
      vigenciaDesde: fechaInicio,
      vigenciaHasta: null,
      esDiciembre: false
    });
  }

  const ggccSection = normalizedText.match(/gastos?\s*comunes[\s\S]{0,350}/i)?.[0] ?? normalizedText;
  const ggccTarifaRaw =
    extractFirstRegexGroup(
      normalizedText,
      /([\d,.]+)\s+unidad(?:es)?\s+de\s+fomento\s+por\s+cada\s+metro\s+cuadrado/i
    ) ?? extractFirstRegexGroup(ggccSection, /([0-9oO][\d\s.,]{1,8})\s*u\.?f\.?\s*x?\s*m2/i);
  const ggccAdminRaw =
    extractFirstRegexGroup(
      normalizedText,
      /(\d+(?:[,.]\d+)?)\s*%\s+[\s\S]{0,120}?administracion\s+de\s+gasto/i
    ) ?? extractFirstRegexGroup(ggccSection, /(\d+(?:[,.]\d+)?)\s*%\s*(?:del?\s+)?gasto\s+comun/i);
  const ggccTarifaBaseUfM2 = ggccTarifaRaw
    ? normalizeDecimal(ggccTarifaRaw, { fixedDecimals: 3, trimTrailingZeros: false })
    : null;
  const ggccPctAdministracion = ggccAdminRaw
    ? normalizeDecimal(ggccAdminRaw, { fixedDecimals: 3, trimTrailingZeros: false })
    : null;

  const ggcc: ContractExtraction["ggcc"] = [];
  if (ggccTarifaBaseUfM2 && ggccPctAdministracion && fechaInicio) {
    ggcc.push({
      tarifaBaseUfM2: ggccTarifaBaseUfM2,
      pctAdministracion: ggccPctAdministracion,
      vigenciaDesde: fechaInicio,
      vigenciaHasta: null,
      proximoReajuste: null
    });
  }

  return {
    numeroContrato,
    arrendatarioRut,
    arrendatarioNombre,
    localCodigo,
    glam2,
    fechaInicio,
    fechaTermino,
    pctRentaVariable,
    pctFondoPromocion,
    tarifas: uniqueByKey(
      tarifas.filter(
        (item): item is ContractExtraction["tarifas"][number] =>
          Boolean(item.valor && item.vigenciaDesde)
      )
    ),
    ggcc
  };
}


