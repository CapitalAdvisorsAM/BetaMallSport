import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExpenseBudget } from "./parse-expense-budget";

function buildWorkbook(
  rows: Array<Record<string, unknown>>,
  sheetName = "Presupuesto"
): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("parseExpenseBudget", () => {
  it("parses valid rows with recognized groups", () => {
    const buffer = buildWorkbook([
      {
        Periodo: "2026-01",
        "GRUPO 1": "GASTOS MARKETING",
        "GRUPO 3": "FONDO DE PROMOCION",
        "Valor UF": 1500
      },
      {
        Periodo: "2026-02",
        "GRUPO 1": "GASTOS INMOBILIARIA",
        "GRUPO 3": "Honorarios Externos",
        "Valor UF": 750.5
      }
    ]);

    const result = parseExpenseBudget(buffer);
    expect(result.rows).toHaveLength(2);
    expect(result.unrecognized).toHaveLength(0);
    expect(result.summary.total).toBe(2);
    expect(result.summary.periodos).toEqual(["2026-01", "2026-02"]);
    expect(result.rows[0].valorUf).toBe(1500);
    expect(result.rows[0].periodo.getUTCFullYear()).toBe(2026);
    expect(result.rows[0].periodo.getUTCMonth()).toBe(0);
  });

  it("sends unknown GRUPO 1 to unrecognized without failing", () => {
    const buffer = buildWorkbook([
      {
        Periodo: "2026-01",
        "GRUPO 1": "GRUPO_INVENTADO",
        "GRUPO 3": "Algo",
        "Valor UF": 100
      },
      {
        Periodo: "2026-01",
        "GRUPO 1": "GASTOS MARKETING",
        "GRUPO 3": "Medios",
        "Valor UF": 200
      }
    ]);

    const result = parseExpenseBudget(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.unrecognized).toHaveLength(1);
    expect(result.unrecognized[0].reason).toMatch(/no es una sección contable/);
    expect(result.unrecognized[0].rowNumber).toBe(2);
  });

  it("flags GRUPO 3 that does not belong to GRUPO 1", () => {
    const buffer = buildWorkbook([
      {
        Periodo: "2026-01",
        "GRUPO 1": "GASTOS MARKETING",
        "GRUPO 3": "Contribuciones",
        "Valor UF": 100
      }
    ]);

    const result = parseExpenseBudget(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.unrecognized).toHaveLength(1);
    expect(result.unrecognized[0].reason).toMatch(/no pertenece a la sección/);
  });

  it("throws when required columns are missing", () => {
    const buffer = buildWorkbook([
      {
        Periodo: "2026-01",
        "GRUPO 1": "GASTOS MARKETING"
      }
    ]);
    expect(() => parseExpenseBudget(buffer)).toThrow(/Faltan columnas obligatorias/);
  });

  it("flags invalid periodo and continues", () => {
    const buffer = buildWorkbook([
      {
        Periodo: "not-a-date",
        "GRUPO 1": "GASTOS MARKETING",
        "GRUPO 3": "Medios",
        "Valor UF": 100
      }
    ]);
    const result = parseExpenseBudget(buffer);
    expect(result.rows).toHaveLength(0);
    expect(result.unrecognized).toHaveLength(1);
    expect(result.unrecognized[0].reason).toMatch(/Periodo invalido/);
  });

  it("throws when no sheet matches the expected name", () => {
    const buffer = buildWorkbook([{ foo: "bar" }], "Otra Hoja");
    expect(() => parseExpenseBudget(buffer)).toThrow(/hoja con nombre/);
  });
});
