import * as XLSX from "xlsx";
import { num, str } from "@/lib/real/parse-utils";

export type FilaVenta = {
  idCa: string;
  tienda: string;
  mes: Date;
  ventasPesos: number;
  categoriaTamano: string;
};

function serialToDate(serial: number): Date {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Convierte nombre de mes en español + año → Date (primer día del mes) */
function mesAnioToDate(mes: string, anio: number): Date | null {
  const meses: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };
  const m = meses[mes.toLowerCase()];
  if (m === undefined) return null;
  return new Date(Date.UTC(anio, m, 1));
}

export function parseVentas(buffer: Buffer): FilaVenta[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });

  const sheetName = wb.SheetNames.find(
    (n) => n.toLowerCase() === "data ventas"
  );
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

  // Acumular ventas por (idCa, tienda, mes)
  type Key = string;
  const acum = new Map<Key, {
    idCa: string;
    tienda: string;
    mes: Date;
    ventasPesos: number;
    categoriaTamano: string;
  }>();

  for (const row of raw) {
    // Filtrar solo Tipo == "Real"
    const tipo = str(row["Tipo"]);
    if (tipo && tipo.toLowerCase() !== "real") continue;

    const idCa = str(row["ID CA"]).trim();
    if (!idCa) continue;

    // Obtener fecha del mes
    let mes: Date | null = null;
    const fechaRaw = row["Fecha"];
    if (typeof fechaRaw === "number") {
      mes = serialToDate(fechaRaw);
    } else if (fechaRaw) {
      mes = new Date(String(fechaRaw));
      if (isNaN(mes.getTime())) mes = null;
    }

    if (!mes) {
      // Fallback: construir desde Mes + Año
      const mesNombre = str(row["Mes"]);
      const anio = parseInt(String(row["Año"] ?? ""), 10);
      if (mesNombre && !isNaN(anio)) {
        mes = mesAnioToDate(mesNombre, anio);
      }
    }
    if (!mes) continue;

    const ventasPesos = num(row["Valor Pesos"] ?? row["Valor UF"]);
    const tienda = str(row["Tienda"]);
    const categoriaTamano = str(row["Categoría (Tamaño)"] ?? row["Categoria (Tamano)"] ?? "");

    const key: Key = `${idCa}__${tienda}__${mes.toISOString().slice(0, 7)}`;
    const existing = acum.get(key);
    if (existing) {
      existing.ventasPesos += ventasPesos;
    } else {
      acum.set(key, { idCa, tienda, mes, ventasPesos, categoriaTamano });
    }
  }

  return [...acum.values()];
}
