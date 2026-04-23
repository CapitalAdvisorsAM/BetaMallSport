import * as XLSX from "xlsx";
import { LINE_ORDER, SECTION_ORDER } from "@/lib/real/eerr";
import { num, str } from "@/lib/real/parse-utils";

const PERIODO_REGEX = /^(\d{4})-(\d{2})$/;

export type ExpenseBudgetRow = {
  periodo: Date;
  grupo1: string;
  grupo3: string;
  valorUf: number;
};

export type UnrecognizedRow = {
  rowNumber: number;
  periodo: string | null;
  grupo1: string;
  grupo3: string;
  reason: string;
};

export type ExpenseBudgetParseResult = {
  rows: ExpenseBudgetRow[];
  unrecognized: UnrecognizedRow[];
  summary: { total: number; periodos: string[] };
};

const REQUIRED_COLUMNS = ["Periodo", "GRUPO 1", "GRUPO 3", "Valor UF"] as const;

function serialToDate(serial: number): Date {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function parsePeriodoValue(raw: unknown): { date: Date; periodo: string } | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const date = serialToDate(raw);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return { date, periodo: `${year}-${month}` };
  }
  const text = String(raw).trim();
  const match = PERIODO_REGEX.exec(text);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    return {
      date: new Date(Date.UTC(year, month - 1, 1)),
      periodo: `${year}-${String(month).padStart(2, "0")}`
    };
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const normalized = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
    const year = normalized.getUTCFullYear();
    const month = String(normalized.getUTCMonth() + 1).padStart(2, "0");
    return { date: normalized, periodo: `${year}-${month}` };
  }
  return null;
}

function validateColumns(firstRow: Record<string, unknown>): string[] {
  return REQUIRED_COLUMNS.filter((column) => !(column in firstRow));
}

export function parseExpenseBudget(buffer: Buffer): ExpenseBudgetParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });

  const sheetName = wb.SheetNames.find((name) => {
    const lower = name.toLowerCase();
    return lower.includes("presupuesto") || lower.includes("ppto") || lower.includes("2026p");
  });

  if (!sheetName) {
    throw new Error(
      `El archivo no contiene una hoja con nombre "Presupuesto" o similar. Hojas disponibles: ${wb.SheetNames.join(", ")}`
    );
  }

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true
  });

  if (raw.length === 0) {
    throw new Error(`La hoja "${sheetName}" está vacía.`);
  }

  const missingColumns = validateColumns(raw[0]);
  if (missingColumns.length > 0) {
    throw new Error(
      `Faltan columnas obligatorias en la hoja "${sheetName}": ${missingColumns.join(", ")}.`
    );
  }

  const rows: ExpenseBudgetRow[] = [];
  const unrecognized: UnrecognizedRow[] = [];
  const periodoSet = new Set<string>();

  const validSections = new Set(SECTION_ORDER);

  raw.forEach((row, index) => {
    const rowNumber = index + 2;
    const periodoRaw = row["Periodo"];
    const periodoParsed = parsePeriodoValue(periodoRaw);
    const grupo1 = str(row["GRUPO 1"]);
    const grupo3 = str(row["GRUPO 3"]);
    const valorRaw = row["Valor UF"];

    if (!periodoParsed) {
      unrecognized.push({
        rowNumber,
        periodo: periodoRaw ? String(periodoRaw) : null,
        grupo1,
        grupo3,
        reason: "Periodo invalido. Formato esperado YYYY-MM."
      });
      return;
    }

    if (!grupo1 || !grupo3) {
      unrecognized.push({
        rowNumber,
        periodo: periodoParsed.periodo,
        grupo1,
        grupo3,
        reason: "GRUPO 1 y GRUPO 3 son obligatorios."
      });
      return;
    }

    if (!validSections.has(grupo1)) {
      unrecognized.push({
        rowNumber,
        periodo: periodoParsed.periodo,
        grupo1,
        grupo3,
        reason: `GRUPO 1 "${grupo1}" no es una sección contable reconocida.`
      });
      return;
    }

    const validLines = LINE_ORDER[grupo1];
    if (validLines && !validLines.includes(grupo3)) {
      unrecognized.push({
        rowNumber,
        periodo: periodoParsed.periodo,
        grupo1,
        grupo3,
        reason: `GRUPO 3 "${grupo3}" no pertenece a la sección "${grupo1}".`
      });
      return;
    }

    const valorUf = num(valorRaw);

    rows.push({
      periodo: periodoParsed.date,
      grupo1,
      grupo3,
      valorUf
    });
    periodoSet.add(periodoParsed.periodo);
  });

  return {
    rows,
    unrecognized,
    summary: {
      total: rows.length,
      periodos: [...periodoSet].sort()
    }
  };
}
