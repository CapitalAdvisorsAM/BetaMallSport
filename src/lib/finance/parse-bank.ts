import * as XLSX from "xlsx";
import { num, str } from "@/lib/finance/parse-utils";

export type BankMovementRow = {
  accountingDate: Date;
  period: Date;
  account: string;
  movement: string;
  operationNumber: string;
  amountClp: number;
  originRut: string;
  originName: string;
  transferComment: string;
  bank: string;
  classification: string;
};

export type BankUnrecognizedRow = {
  rowNumber: number;
  operationNumber: string;
  reason: string;
};

export type BankParseResult = {
  rows: BankMovementRow[];
  unrecognized: BankUnrecognizedRow[];
  summary: { total: number; periods: string[] };
};

function serialToDate(serial: number): Date {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseAccountingDate(raw: unknown): Date | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return serialToDate(raw);
  }
  const parsed = new Date(String(raw ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function parseBank(buffer: Buffer): BankParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames.find((name) => {
    const lower = name.toLowerCase();
    return lower === "data bco" || lower.includes("bco") || lower.includes("banco");
  });

  if (!sheetName) {
    throw new Error(
      `El archivo no contiene la hoja "Data Bco". Hojas disponibles: ${wb.SheetNames.join(", ")}`
    );
  }

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true
  });

  const rows: BankMovementRow[] = [];
  const unrecognized: BankUnrecognizedRow[] = [];
  const periods = new Set<string>();

  raw.forEach((row, index) => {
    const rowNumber = index + 2;
    const account = str(row["CC"]);
    const movement = str(row["Movimiento"]);
    const operationNumber = str(row["N° Operación"] ?? row["N° Operacion"] ?? row["Numero Operacion"]);
    const bank = str(row["banco"] ?? row["Banco"]);
    const classification = str(row["Clasificación"] ?? row["Clasificacion"]);
    const accountingDate = parseAccountingDate(row["Fecha contable"]);

    if (!account || !movement || !bank || !classification) {
      return;
    }

    if (!accountingDate) {
      unrecognized.push({
        rowNumber,
        operationNumber,
        reason: "Fecha contable inválida."
      });
      return;
    }

    const period = new Date(Date.UTC(accountingDate.getUTCFullYear(), accountingDate.getUTCMonth(), 1));
    rows.push({
      accountingDate,
      period,
      account,
      movement,
      operationNumber,
      amountClp: num(row["Abono (+)"]),
      originRut: str(row["RUT de origen"]),
      originName: str(row["Nombre de origen"]),
      transferComment: str(row["Comentario transferencia"]),
      bank,
      classification
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
