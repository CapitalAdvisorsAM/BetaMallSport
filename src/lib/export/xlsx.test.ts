import { describe, expect, it } from "vitest";
import { read } from "xlsx";
import { buildExcelWorkbookBuffer, createExcelDownloadResponse } from "@/lib/export/xlsx";

describe("buildExcelWorkbookBuffer", () => {
  it("creates a workbook with provided sheet names", () => {
    const buffer = buildExcelWorkbookBuffer([
      {
        name: "Resumen",
        headers: ["Columna"],
        rows: [["valor"]]
      },
      {
        name: "Detalle",
        headers: ["A", "B"],
        rows: [
          [1, 2],
          [3, 4]
        ]
      }
    ]);

    const workbook = read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Resumen", "Detalle"]);
  });

  it("deduplicates repeated sheet names", () => {
    const buffer = buildExcelWorkbookBuffer([
      { name: "Hoja", headers: ["A"], rows: [[1]] },
      { name: "Hoja", headers: ["A"], rows: [[2]] }
    ]);

    const workbook = read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Hoja", "Hoja-2"]);
  });
});

describe("createExcelDownloadResponse", () => {
  it("returns Excel content headers", () => {
    const buffer = Buffer.from("test");
    const response = createExcelDownloadResponse(buffer, "Reporte General");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("content-disposition")).toContain("reporte-general.xlsx");
  });
});
