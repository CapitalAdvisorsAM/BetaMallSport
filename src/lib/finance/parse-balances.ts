import * as XLSX from "xlsx";
import { num, str } from "@/lib/finance/parse-utils";

export type BalanceRow = {
  period: Date;
  accountCode: string;
  accountName: string;
  accountNameAlt: string;
  debitsClp: number;
  creditsClp: number;
  debtorClp: number;
  creditorClp: number;
  assetClp: number;
  liabilityClp: number;
  lossesClp: number;
  gainsClp: number;
  diffClp: number;
  category: string;
  groupName: string;
  valueUf: number;
};

export type BalanceUnrecognizedRow = {
  rowNumber: number;
  accountCode: string;
  reason: string;
};

export type BalanceParseResult = {
  rows: BalanceRow[];
  unrecognized: BalanceUnrecognizedRow[];
  summary: { total: number; periods: string[] };
};

function serialToDate(serial: number): Date {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function parsePeriod(raw: unknown): Date | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return serialToDate(raw);
  }
  const parsed = new Date(String(raw ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function normalizeHeaders(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[str(key).toLowerCase()] = value;
  }
  return normalized;
}

export function parseBalances(buffer: Buffer): BalanceParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames.find((name) => {
    const lower = name.toLowerCase();
    return lower === "data balances" || lower.includes("balances");
  });

  if (!sheetName) {
    throw new Error(
      `El archivo no contiene la hoja "Data Balances". Hojas disponibles: ${wb.SheetNames.join(", ")}`
    );
  }

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
    range: 6
  });

  const rows: BalanceRow[] = [];
  const unrecognized: BalanceUnrecognizedRow[] = [];
  const periods = new Set<string>();

  raw.forEach((sourceRow, index) => {
    const rowNumber = index + 8;
    const row = normalizeHeaders(sourceRow);
    const accountCode = str(row["codigo"]);
    const accountName = str(row["nombre"]);
    const period = parsePeriod(row["fecha"]);
    const groupName = str(row["grupo"]);
    const category = str(row["categoría"] ?? row["categoria"]);

    if (!accountCode || !accountName) {
      return;
    }

    if (!period) {
      unrecognized.push({
        rowNumber,
        accountCode,
        reason: "Fecha inválida en balance."
      });
      return;
    }

    if (!groupName || !category) {
      unrecognized.push({
        rowNumber,
        accountCode,
        reason: "Grupo y categoría son obligatorios."
      });
      return;
    }

    rows.push({
      period,
      accountCode,
      accountName,
      accountNameAlt: str(row["nombre2"]),
      debitsClp: num(row["debitos"]),
      creditsClp: num(row["creditos"]),
      debtorClp: num(row["deudor"]),
      creditorClp: num(row["acreedor"]),
      assetClp: num(row["activo"]),
      liabilityClp: num(row["pasivo"]),
      lossesClp: num(row["perdidas"]),
      gainsClp: num(row["ganancias"]),
      diffClp: num(row["diff"]),
      category,
      groupName,
      valueUf: num(row["valor uf"])
    });
    periods.add(period.toISOString().slice(0, 7));
  });

  return {
    rows,
    unrecognized,
    summary: {
      total: rows.length,
      periods: [...periods].sort()
    }
  };
}
