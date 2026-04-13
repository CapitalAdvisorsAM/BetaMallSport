import * as XLSX from "xlsx";
import { num, str } from "@/lib/finance/parse-utils";

export type FilaVentaPresupuestada = {
  idCa: number;
  tienda: string;
  mes: Date;
  ventasUf: number;
};

function serialToDate(serial: number): Date {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function mesAnioToDate(mes: string, anio: number): Date | null {
  const meses: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };
  const m = meses[mes.toLowerCase()];
  if (m === undefined) return null;
  return new Date(Date.UTC(anio, m, 1));
}

const ACCEPTED_SHEET_NAMES = ["data presupuesto", "presupuesto ventas"];

export function parseVentasPresupuestadas(buffer: Buffer): FilaVentaPresupuestada[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });

  const sheetName = wb.SheetNames.find(
    (n) => ACCEPTED_SHEET_NAMES.includes(n.toLowerCase())
  );
  if (!sheetName) {
    throw new Error(
      `El archivo no contiene la hoja "Data Presupuesto" ni "Presupuesto Ventas". Hojas disponibles: ${wb.SheetNames.join(", ")}`
    );
  }

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true
  });

  type Key = string;
  const acum = new Map<Key, {
    idCa: number;
    tienda: string;
    mes: Date;
    ventasUf: number;
  }>();

  for (const row of raw) {
    const idCaRaw = row["ID CA"];
    if (!idCaRaw) continue;
    const idCa = parseInt(String(idCaRaw), 10);
    if (isNaN(idCa)) continue;

    let mes: Date | null = null;
    const fechaRaw = row["Fecha"];
    if (typeof fechaRaw === "number") {
      mes = serialToDate(fechaRaw);
    } else if (fechaRaw) {
      mes = new Date(String(fechaRaw));
      if (isNaN(mes.getTime())) mes = null;
    }

    if (!mes) {
      const mesNombre = str(row["Mes"]);
      const anio = parseInt(String(row["Año"] ?? ""), 10);
      if (mesNombre && !isNaN(anio)) {
        mes = mesAnioToDate(mesNombre, anio);
      }
    }
    if (!mes) continue;

    const ventasUf = num(row["Valor UF"]);
    const tienda = str(row["Tienda"]);

    const key: Key = `${idCa}__${mes.toISOString().slice(0, 7)}`;
    const existing = acum.get(key);
    if (existing) {
      existing.ventasUf += ventasUf;
    } else {
      acum.set(key, { idCa, tienda, mes, ventasUf });
    }
  }

  return [...acum.values()];
}
