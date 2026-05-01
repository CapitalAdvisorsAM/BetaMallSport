import { AccountingScenario } from "@prisma/client";
import * as XLSX from "xlsx";
import { num, str } from "@/lib/real/parse-utils";

export type FilaContable = {
  mes: Date;
  localCodigo: string;
  arrendatarioNombre: string;
  grupo0: string;
  grupo1: string;
  grupo2: string;
  grupo3: string;
  denominacion: string;
  clCoste: string;
  descripcionClCoste: string;
  valorUf: number;
  valorClp: number;
  categoriaTamano: string;
  categoriaTipo: string;
  piso: string;
  documento: string;
  textoCabDocumento: string;
  esGla: boolean | null;
  scenario: AccountingScenario;
};

function parseScenario(raw: string): AccountingScenario | null {
  const v = raw.trim().toLowerCase();
  if (v === "real") return AccountingScenario.REAL;
  if (v === "ppto" || v === "presupuesto" || v === "budget") return AccountingScenario.PPTO;
  return null;
}

function parseGlaFlag(raw: string): boolean | null {
  const v = raw.trim().toUpperCase();
  if (v === "GLA") return true;
  if (v === "NO GLA") return false;
  return null;
}

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
    const ceCoste = str(row["Ce.coste"]);
    const scenario = parseScenario(ceCoste);
    // Filas sin escenario reconocible (vacío, "x", etc.) se descartan
    if (!scenario) continue;

    const mesRaw = row["Mes"];
    if (!mesRaw) continue;

    const mes = typeof mesRaw === "number" ? serialToDate(mesRaw) : new Date(String(mesRaw));
    if (isNaN(mes.getTime())) continue;

    const localRaw = str(row["Local"] ?? row["Denominación objeto"] ?? "");
    const localCodigo = extractLocalCodigo(localRaw);
    // Nota: filas sin Local quedan con localCodigo === "" y se persisten con unitId null.

    const valorUf = num(row["Valor UF"]);
    // Incluir filas con valor 0 (pueden ser importantes para el EE.RR)

    const grupo1 = str(row["GRUPO 1"]);
    const grupo3 = str(row["GRUPO 3"]);
    if (!grupo1) continue;

    const valorClp = num(
      row["Valor/mon.inf."] ??
        row["Valor/mon.inf. (CLP)"] ??
        row["Valor mon.inf."] ??
        row["Valor mon.inf. (CLP)"] ??
        row["Valor (CLP)"] ??
        0
    );

    filas.push({
      mes,
      localCodigo,
      arrendatarioNombre: str(row["Arrendatario"]),
      grupo0: str(row["GRUPO 0"]),
      grupo1,
      grupo2: str(row["GRUPO 2"]),
      grupo3,
      denominacion: str(row["Denominación objeto"] ?? row["Denominacion objeto"] ?? ""),
      clCoste: str(row["Cl.coste"] ?? row["Cl coste"] ?? ""),
      descripcionClCoste: str(
        row["Descrip.clases coste"] ??
          row["Descripcion clases coste"] ??
          row["Descrip clases coste"] ??
          ""
      ),
      valorUf,
      valorClp,
      categoriaTamano: str(row["Categoría (Tamaño)"] ?? row["Categoria (Tamano)"] ?? ""),
      categoriaTipo: str(row["Categoría (Tipo)"] ?? row["Categoria (Tipo)"] ?? ""),
      piso: str(row["Piso"] ?? ""),
      documento: str(row["Documento"] ?? ""),
      textoCabDocumento: str(row["Texto cab.documento"] ?? row["Texto cab documento"] ?? ""),
      esGla: parseGlaFlag(str(row["GLA / NO GLA"] ?? row["GLA/NO GLA"] ?? row["GLA"] ?? "")),
      scenario
    });
  }

  return filas;
}

