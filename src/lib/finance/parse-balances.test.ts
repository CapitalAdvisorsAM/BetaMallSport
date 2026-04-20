import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBalances } from "./parse-balances";

function buildWorkbook(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Balances");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("parseBalances", () => {
  it("parses balance rows from Data Balances", () => {
    const buffer = buildWorkbook([
      [],
      [],
      [],
      [],
      [],
      [],
      ["codigo", "nombre", "nombre2", "debitos", "creditos", "deudor", "acreedor", "activo", "pasivo", "perdidas", "ganancias", "Diff", "Fecha", "Categoría", "Grupo", "Valor UF"],
      ["110101", "Caja", "", "-", "145,497", "-", "145,497", "-", "145,497", "-", "-", "(145,497)", "2025-06-30", "Efectivo y equivalentes al efectivo", "Activos Corrientes", "-3.71"]
    ]);

    const result = parseBalances(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.unrecognized).toHaveLength(0);
    expect(result.summary.periods).toEqual(["2025-06"]);
    expect(result.rows[0]).toMatchObject({
      accountCode: "110101",
      accountName: "Caja",
      creditsClp: 145497,
      creditorClp: 145497,
      diffClp: -145497,
      groupName: "Activos Corrientes",
      category: "Efectivo y equivalentes al efectivo",
      valueUf: -3.71
    });
  });

  it("flags invalid rows and continues", () => {
    const buffer = buildWorkbook([
      [],
      [],
      [],
      [],
      [],
      [],
      ["codigo", "nombre", "nombre2", "debitos", "creditos", "deudor", "acreedor", "activo", "pasivo", "perdidas", "ganancias", "Diff", "Fecha", "Categoría", "Grupo", "Valor UF"],
      ["110101", "Caja", "", "-", "145,497", "-", "145,497", "-", "145,497", "-", "-", "(145,497)", "bad-date", "Efectivo", "Activos Corrientes", "-3.71"],
      ["110102", "Banco", "", "-", "100,000", "-", "100,000", "-", "100,000", "-", "-", "-", "2025-06-30", "Efectivo", "Activos Corrientes", "-2.55"]
    ]);

    const result = parseBalances(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.unrecognized).toHaveLength(1);
    expect(result.unrecognized[0]?.reason).toMatch(/Fecha inválida/i);
  });
});
