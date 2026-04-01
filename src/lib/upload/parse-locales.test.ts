import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { parseLocalesFile } from "@/lib/upload/parse-locales";

function buildWorkbookBuffer(dataRows: string[][]): ArrayBuffer {
  const sheet = utils.aoa_to_sheet([
    ["Plantilla de Locales"],
    [],
    ["codigo", "nombre", "glam2", "piso", "tipo", "zona", "esgla", "estado"],
    ...dataRows
  ]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Locales");

  const output = write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  return Uint8Array.from(output).buffer;
}

describe("parseLocalesFile", () => {
  it("marks duplicate codigo rows in the same file as error", () => {
    const preview = parseLocalesFile(
      buildWorkbookBuffer([
        ["L-101", "Local 101", "55", "1", "LOCAL_COMERCIAL", "", "true", "ACTIVO"],
        ["l-101", "Local 101 B", "60", "1", "LOCAL_COMERCIAL", "", "true", "ACTIVO"]
      ]),
      new Map()
    );

    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]?.status).toBe("NEW");
    expect(preview.rows[1]?.status).toBe("ERROR");
    expect(preview.rows[1]?.errorMessage).toContain("codigo duplicado");
  });

  it("allows empty glam2 and emits warning", () => {
    const preview = parseLocalesFile(
      buildWorkbookBuffer([["L-201", "Local 201", "", "2", "LOCAL_COMERCIAL", "", "true", "ACTIVO"]]),
      new Map()
    );

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.status).toBe("NEW");
    expect(preview.rows[0]?.data.glam2).toBe("0");
    expect(preview.warnings.length).toBeGreaterThan(0);
    expect(preview.warnings[0]).toContain("GLA m2 vacio");
  });
});
