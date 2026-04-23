import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBank } from "./parse-bank";

function buildWorkbook(rows: Array<Record<string, unknown>>): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Bco");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

describe("parseBank", () => {
  it("parses bank movements from Data Bco", () => {
    const buffer = buildWorkbook([
      {
        CC: "Ingreso Clientes",
        "Fecha contable": "2025-02-01",
        Movimiento: "Transferencia recibida",
        "N° Operación": "87241342",
        "Abono (+)": "2,305,296",
        "RUT de origen": "76991643-1",
        "Nombre de origen": "Cliente SPA",
        "Comentario transferencia": "",
        banco: "BCI",
        Clasificación: "Ingresos Bco"
      }
    ]);

    const result = parseBank(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.unrecognized).toHaveLength(0);
    expect(result.summary.periods).toEqual(["2025-02"]);
    expect(result.rows[0]).toMatchObject({
      account: "Ingreso Clientes",
      operationNumber: "87241342",
      amountClp: 2305296,
      bank: "BCI",
      classification: "Ingresos Bco"
    });
  });

  it("flags invalid dates and continues", () => {
    const buffer = buildWorkbook([
      {
        CC: "Ingreso Clientes",
        "Fecha contable": "bad-date",
        Movimiento: "Transferencia recibida",
        "N° Operación": "87241342",
        "Abono (+)": "2,305,296",
        banco: "BCI",
        Clasificación: "Ingresos Bco"
      },
      {
        CC: "Ingreso Clientes",
        "Fecha contable": "2025-02-03",
        Movimiento: "Transferencia recibida",
        "N° Operación": "87241343",
        "Abono (+)": "64,097",
        banco: "BCI",
        Clasificación: "Ingresos Bco"
      }
    ]);

    const result = parseBank(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.unrecognized).toHaveLength(1);
    expect(result.unrecognized[0]?.reason).toMatch(/Fecha contable inválida/i);
  });
});
