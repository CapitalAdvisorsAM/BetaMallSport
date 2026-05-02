import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseVentasDiarias } from "./parse-sales-daily";

function buildWorkbook(rows: Array<Record<string, unknown>>): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Ventas");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("parseVentasDiarias", () => {
  it("parses daily sales rows from Data Ventas", () => {
    const buffer = buildWorkbook([
      {
        Tipo: "Real",
        "ID CA": 101,
        Tienda: "Adidas",
        Fecha: "2026-03-01",
        "Valor Pesos": 1500000,
        "Total Boletas": 1200000,
        "Total Boletas Exentas": 0,
        "Total Facturas": 300000,
        "Total Notas Credito": 0,
        "Categoria (Tamano)": "Tienda Mediana",
        "Categoria (Tipo)": "Multideporte",
        Piso: "1",
        GLA: "GLA"
      },
      {
        Tipo: "Real",
        "ID CA": 101,
        Tienda: "Adidas",
        Fecha: "2026-03-02",
        "Valor Pesos": 800000
      }
    ]);

    const result = parseVentasDiarias(buffer);
    expect(result).toHaveLength(2);
    expect(result[0]?.idCa).toBe("101");
    expect(result[0]?.dia).toBe(1);
    expect(result[0]?.ventasPesos).toBe(1500000);
    expect(result[0]?.totalBoletas).toBe(1200000);
    expect(result[0]?.categoriaTamano).toBe("Tienda Mediana");
    expect(result[0]?.categoriaTipo).toBe("Multideporte");
    expect(result[0]?.piso).toBe("1");
    expect(result[1]?.dia).toBe(2);
    expect(result[1]?.ventasPesos).toBe(800000);
  });

  it("aggregates duplicate (idCa, tienda, fecha) rows", () => {
    const buffer = buildWorkbook([
      { Tipo: "Real", "ID CA": 7, Tienda: "X", Fecha: "2026-03-15", "Valor Pesos": 500 },
      { Tipo: "Real", "ID CA": 7, Tienda: "X", Fecha: "2026-03-15", "Valor Pesos": 200 }
    ]);

    const result = parseVentasDiarias(buffer);
    expect(result).toHaveLength(1);
    expect(result[0]?.ventasPesos).toBe(700);
  });

  it("filters out non-Real rows", () => {
    const buffer = buildWorkbook([
      { Tipo: "Presupuesto", "ID CA": 1, Tienda: "A", Fecha: "2026-03-01", "Valor Pesos": 1 },
      { Tipo: "Real", "ID CA": 2, Tienda: "B", Fecha: "2026-03-01", "Valor Pesos": 2 }
    ]);

    const result = parseVentasDiarias(buffer);
    expect(result).toHaveLength(1);
    expect(result[0]?.idCa).toBe("2");
  });

  it("keeps alphanumeric ID CA values", () => {
    const buffer = buildWorkbook([
      { Tipo: "Real", "ID CA": "L102", Tienda: "Mitburger", Fecha: "2026-03-01", "Valor Pesos": 1000 }
    ]);

    const result = parseVentasDiarias(buffer);
    expect(result).toHaveLength(1);
    expect(result[0]?.idCa).toBe("L102");
    expect(result[0]?.tienda).toBe("Mitburger");
  });

  it("derives period as the first day of the month", () => {
    const buffer = buildWorkbook([
      { Tipo: "Real", "ID CA": 5, Tienda: "C", Fecha: "2026-03-15", "Valor Pesos": 100 }
    ]);

    const result = parseVentasDiarias(buffer);
    expect(result[0]?.periodo.toISOString().slice(0, 10)).toBe("2026-03-01");
  });

  it("throws when the Data Ventas sheet is missing", () => {
    const ws = XLSX.utils.json_to_sheet([{ a: 1 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    expect(() => parseVentasDiarias(buffer)).toThrow(/Data Ventas/);
  });
});
