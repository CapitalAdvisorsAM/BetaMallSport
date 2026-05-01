import * as XLSX from "xlsx";
import { num, str } from "@/lib/real/parse-utils";

export type FilaVentaDiaria = {
  idCa: string;
  tienda: string;
  fecha: Date;
  periodo: Date;
  dia: number;
  totalBoletas: number;
  totalBoletasExentas: number;
  totalFacturas: number;
  totalNotasCredito: number;
  ventasPesos: number;
  fechaRegistro: Date | null;
  categoriaTamano: string | null;
  categoriaTipo: string | null;
  piso: string | null;
  glaTipo: string | null;
};

function serialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function readDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return serialToDate(raw);
  const parsed = new Date(String(raw));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function strOrNull(raw: unknown): string | null {
  const v = str(raw).trim();
  return v.length > 0 ? v : null;
}

/**
 * Parses the "Data Ventas" sheet at daily granularity.
 *
 * Aggregates duplicate rows for the same (idCa, tienda, fecha) by summing receipt
 * totals and ventasPesos, while keeping the latest non-null metadata fields
 * (categoria/piso/etc.). Only Tipo = "Real" rows are kept.
 */
export function parseVentasDiarias(buffer: Buffer): FilaVentaDiaria[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });

  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === "data ventas");
  if (!sheetName) {
    throw new Error(
      `El archivo no contiene la hoja "Data Ventas". Hojas disponibles: ${wb.SheetNames.join(", ")}`
    );
  }

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true
  });

  const acum = new Map<string, FilaVentaDiaria>();

  for (const row of raw) {
    const tipo = str(row["Tipo"]);
    if (tipo && tipo.toLowerCase() !== "real") continue;

    const idCa = str(row["ID CA"]).trim();
    if (!idCa) continue;

    const fechaParsed = readDate(row["Fecha"]);
    if (!fechaParsed) continue;
    const fecha = startOfUtcDay(fechaParsed);

    const tienda = str(row["Tienda"]);
    const totalBoletas = num(row["Total Boletas"] ?? row["Boletas"]);
    const totalBoletasExentas = num(row["Total Boletas Exentas"] ?? row["Boletas Exentas"]);
    const totalFacturas = num(row["Total Facturas"] ?? row["Facturas"]);
    const totalNotasCredito = num(row["Total Notas Credito"] ?? row["Total Notas Crédito"] ?? row["Notas Credito"] ?? row["Notas Crédito"]);
    const ventasPesos = num(row["Valor Pesos"] ?? row["Total"] ?? row["Valor UF"]);
    const fechaRegistro = readDate(row["Fecha Registro"]);
    const categoriaTamano = strOrNull(row["Categoria (Tamano)"] ?? row["Categoría (Tamaño)"]);
    const categoriaTipo = strOrNull(row["Categoria (Tipo)"] ?? row["Categoría (Tipo)"]);
    const piso = strOrNull(row["Piso"]);
    const glaTipo = strOrNull(row["GLA"] ?? row["GLA (Aplica o no)"]);

    const key = `${idCa}__${tienda}__${fecha.toISOString().slice(0, 10)}`;
    const existing = acum.get(key);
    if (existing) {
      existing.totalBoletas += totalBoletas;
      existing.totalBoletasExentas += totalBoletasExentas;
      existing.totalFacturas += totalFacturas;
      existing.totalNotasCredito += totalNotasCredito;
      existing.ventasPesos += ventasPesos;
      existing.fechaRegistro = existing.fechaRegistro ?? fechaRegistro;
      existing.categoriaTamano = existing.categoriaTamano ?? categoriaTamano;
      existing.categoriaTipo = existing.categoriaTipo ?? categoriaTipo;
      existing.piso = existing.piso ?? piso;
      existing.glaTipo = existing.glaTipo ?? glaTipo;
    } else {
      acum.set(key, {
        idCa,
        tienda,
        fecha,
        periodo: startOfUtcMonth(fecha),
        dia: fecha.getUTCDate(),
        totalBoletas,
        totalBoletasExentas,
        totalFacturas,
        totalNotasCredito,
        ventasPesos,
        fechaRegistro,
        categoriaTamano,
        categoriaTipo,
        piso,
        glaTipo
      });
    }
  }

  return [...acum.values()];
}
