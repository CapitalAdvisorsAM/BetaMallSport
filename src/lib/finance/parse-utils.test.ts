import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseContable } from "@/lib/finance/parse-accounting";
import { parseVentas } from "@/lib/finance/parse-sales";
import { num, similarity, str } from "@/lib/finance/parse-utils";

describe("parse-utils", () => {
  describe("similarity", () => {
    it("returns 1 for equal strings (case-insensitive)", () => {
      expect(similarity("MALLSPORT", "mallsport")).toBe(1);
    });

    it("returns 0 for empty or too-short strings", () => {
      expect(similarity("", "ABC")).toBe(0);
      expect(similarity("A", "AB")).toBe(0);
    });

    it("returns expected value for partial overlap", () => {
      expect(similarity("ABCD", "ABEF")).toBeCloseTo(1 / 3, 6);
    });
  });

  describe("str", () => {
    it("normalizes nullish values and trims whitespace", () => {
      expect(str(null)).toBe("");
      expect(str(undefined)).toBe("");
      expect(str("  Hola  ")).toBe("Hola");
    });
  });

  describe("num", () => {
    it("parses decimal values with comma and dot", () => {
      expect(num("123,45")).toBeCloseTo(123.45);
      expect(num("67.89")).toBeCloseTo(67.89);
    });

    it("parses thousands separators and accounting negatives", () => {
      expect(num("2,305,296")).toBe(2305296);
      expect(num("54.027.239,50")).toBeCloseTo(54027239.5);
      expect(num("(145,497)")).toBe(-145497);
    });

    it("returns 0 for invalid numbers", () => {
      expect(num("no-numero")).toBe(0);
      expect(num(undefined)).toBe(0);
    });
  });
});

describe("parser smoke tests", () => {
  it("parseContable reads representative rows from Data Contable", () => {
    const aoa = [
      ["Ce.coste", "Mes", "Local", "Arrendatario", "GRUPO 1", "GRUPO 3", "Denominacion objeto", "Valor UF", "Categoria (Tamano)", "Categoria (Tipo)", "Piso"],
      ["Real", "2026-01-01", "[L102] TIENDA A", "Tenant A", "INGRESOS DE EXPLOTACION", "Renta Fija", "Renta Fija", "100,5", "Mediano", "Moda", "1"],
      ["Presupuesto", "2026-01-01", "[L999] IGNORAR", "Tenant B", "INGRESOS DE EXPLOTACION", "Renta Fija", "Renta Fija", "999", "Grande", "Moda", "2"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Contable");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const filas = parseContable(buffer);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      localCodigo: "102",
      arrendatarioNombre: "Tenant A",
      grupo1: "INGRESOS DE EXPLOTACION",
      grupo3: "Renta Fija",
      valorUf: 100.5,
      categoriaTamano: "Mediano",
      categoriaTipo: "Moda",
      piso: "1"
    });
    expect(filas[0]?.mes.toISOString().slice(0, 7)).toBe("2026-01");
  });

  it("parseVentas aggregates rows by local and month", () => {
    const aoa = [
      ["Tipo", "ID CA", "Fecha", "Valor UF", "Tienda", "Categoria (Tamano)"],
      ["Real", 10, "2026-02-01", "30,5", "Store 10", "Grande"],
      ["Real", 10, "2026-02-15", "9,5", "Store 10", "Grande"],
      ["Presupuesto", 10, "2026-02-01", "999", "Store 10", "Grande"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Ventas");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const filas = parseVentas(buffer);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      idCa: 10,
      tienda: "Store 10",
      ventasPesos: 40,
      categoriaTamano: "Grande"
    });
    expect(filas[0]?.mes.toISOString().slice(0, 7)).toBe("2026-02");
  });
});


