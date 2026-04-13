import * as XLSX from "xlsx";
import { num, str } from "@/lib/finance/parse-utils";

export type FilaContable = {
  mes: Date;
  localCodigo: string;
  arrendatarioNombre: string;
  grupo1: string;
  grupo3: string;
  denominacion: string;
  valorUf: number;
  categoriaTamano: string;
  categoriaTipo: string;
  piso: string;
};

/** Convierte número serial de Excel a Date (primer día del mes) */
function serialToDate(serial: number): Date {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Extrae código numérico de strings tipo "[L102]  MOUNTAIN HARDWEAR" â†’ "102" */
function extractLocalCodigo(raw: string): string {
  const match = /\[L(\d+)\]/i.exec(raw);
  if (match) return match[1];
  // Fallback: si es solo número
  const numMatch = /^(\d+)$/.exec(raw.trim());
  return numMatch ? numMatch[1] : raw.trim();
}

export function parseContable(buffer: Buffer): FilaContable[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });

  // Intentar hoja "Data Contable" primero, luego "Maestro"
  const sheetName = wb.SheetNames.find(
    (n) => n.toLowerCase() === "data contable" || n.toLowerCase() === "maestro"
  );
  if (!sheetName) {
    throw new Error(
      `El archivo no contiene la hoja "Data Contable" ni "Maestro". Hojas disponibles: ${wb.SheetNames.join(", ")}`
    );
  }

  const ws = wb.Sheets[sheetName];

  // Detectar fila de headers: buscar la fila que contenga "Mes" o "GRUPO 1"
  // Para "Data Contable" del CDG, headers están en fila 4 (índice 3)
  // Para "Maestro" de archivos mensuales, headers en fila 4
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
    // Para el CDG, los headers están en fila 4 (offset 3)
  });

  const filas: FilaContable[] = [];

  for (const row of raw) {
    // Filtrar solo filas con Ce.coste == "Real"
    const ceCoste = str(row["Ce.coste"]);
    if (ceCoste && ceCoste.toLowerCase() !== "real") continue;

    const mesRaw = row["Mes"];
    if (!mesRaw) continue;

    const mes = typeof mesRaw === "number" ? serialToDate(mesRaw) : new Date(String(mesRaw));
    if (isNaN(mes.getTime())) continue;

    const localRaw = str(row["Local"] ?? row["Denominación objeto"] ?? "");
    const localCodigo = extractLocalCodigo(localRaw);
    if (!localCodigo) continue;

    const valorUf = num(row["Valor UF"]);
    // Incluir filas con valor 0 (pueden ser importantes para el EE.RR)

    const grupo1 = str(row["GRUPO 1"]);
    const grupo3 = str(row["GRUPO 3"]);
    if (!grupo1) continue;

    filas.push({
      mes,
      localCodigo,
      arrendatarioNombre: str(row["Arrendatario"]),
      grupo1,
      grupo3,
      denominacion: str(row["Denominación objeto"] ?? row["Denominacion objeto"] ?? ""),
      valorUf,
      categoriaTamano: str(row["Categoría (Tamaño)"] ?? row["Categoria (Tamano)"] ?? ""),
      categoriaTipo: str(row["Categoría (Tipo)"] ?? row["Categoria (Tipo)"] ?? ""),
      piso: str(row["Piso"] ?? "")
    });
  }

  return filas;
}

