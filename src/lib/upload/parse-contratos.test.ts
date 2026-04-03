import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import type { ExistingContratoForDiff } from "@/lib/upload/parse-contratos";
import { buildContratoLookupKey, parseContratosFile } from "@/lib/upload/parse-contratos";

function buildWorkbookBuffer(headers: string[], dataRows: string[][]): ArrayBuffer {
  const sheet = utils.aoa_to_sheet([["Plantilla de Contratos"], [], headers, ...dataRows]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Contratos");

  const output = write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  return Uint8Array.from(output).buffer;
}

function parseRows(
  dataRows: string[][],
  existingContratos: Map<string, ExistingContratoForDiff> = new Map()
) {
  return parseContratosFile(
    buildWorkbookBuffer(
      [
        "localcodigo",
        "arrendatariorut",
        "estado",
        "fechainicio",
        "fechatermino",
        "tarifatipo",
        "tarifavalor",
        "tarifavigenciadesde",
        "tarifavigenciahasta",
        "rentavariablepct",
        "ggccpctadministracion",
        "ggccmesesreajuste",
        "ggccpctreajuste",
        "ggcctipo",
        "ggccvalor",
        "ggccvigenciadesde",
        "ggccvigenciahasta"
      ],
      dataRows
    ),
    {
      existingContratos,
      existingLocalData: new Map([["L-101", { glam2: "100" }]]),
      existingArrendatarioRuts: new Set(["76543210-k"])
    }
  );
}

describe("parseContratosFile", () => {
  it("uses contract dates automatically for renta variable loaded via rentaVariablePct", () => {
    const preview = parseRows([
      ["L-101", "76543210-k", "VIGENTE", "2026-01-01", "2026-12-31", "", "", "", "", "5.5"]
    ]);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.status).toBe("NEW");
    expect(preview.rows[0]?.data.tarifaTipo).toBe("PORCENTAJE");
    expect(preview.rows[0]?.data.tarifaValor).toBe("5.5");
    expect(preview.rows[0]?.data.tarifaVigenciaDesde).toBe("2026-01-01");
    expect(preview.rows[0]?.data.tarifaVigenciaHasta).toBe("2026-12-31");
  });

  it("uses contract dates automatically for PORCENTAJE even if tariff dates are empty", () => {
    const preview = parseRows([
      ["L-101", "76543210-k", "VIGENTE", "2026-03-01", "2027-02-28", "PORCENTAJE", "7", "", "", ""]
    ]);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.status).toBe("NEW");
    expect(preview.rows[0]?.data.tarifaTipo).toBe("PORCENTAJE");
    expect(preview.rows[0]?.data.tarifaValor).toBe("7");
    expect(preview.rows[0]?.data.tarifaVigenciaDesde).toBe("2026-03-01");
    expect(preview.rows[0]?.data.tarifaVigenciaHasta).toBe("2027-02-28");
  });

  it("accepts GGCC pctReajuste when ggccMesesReajuste is informed", () => {
    const preview = parseRows([
      [
        "L-101",
        "76543210-k",
        "VIGENTE",
        "2026-01-01",
        "2026-12-31",
        "FIJO_UF_M2",
        "3.5",
        "2026-01-01",
        "",
        "",
        "8",
        "12",
        "5",
        "FIJO_UF_M2",
        "0.45",
        "2026-01-01",
        ""
      ]
    ]);

    expect(preview.rows[0]?.status).toBe("NEW");
    expect(preview.rows[0]?.data.ggccPctReajuste).toBe("5");
  });

  it("rejects GGCC months without pctReajuste", () => {
    const preview = parseRows([
      [
        "L-101",
        "76543210-k",
        "VIGENTE",
        "2026-01-01",
        "2026-12-31",
        "FIJO_UF_M2",
        "3.5",
        "2026-01-01",
        "",
        "",
        "8",
        "12",
        "",
        "FIJO_UF_M2",
        "0.45",
        "2026-01-01",
        ""
      ]
    ]);

    expect(preview.rows[0]?.status).toBe("ERROR");
    expect(preview.rows[0]?.errorMessage).toContain("ggccPctReajuste");
  });

  it("marks row as updated when only ggccPctReajuste changes", () => {
    const existingSnapshot = {
      numeroContrato: "C-400",
      localCodigo: "L-101",
      arrendatarioRut: "76543210-k",
      estado: "VIGENTE" as const,
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      fechaEntrega: null,
      fechaApertura: null,
      pctFondoPromocion: null,
      codigoCC: null,
      ggccPctAdministracion: "8",
      notas: null,
      tarifas: [
        {
          tipo: "FIJO_UF_M2" as const,
          valor: "3.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null
        }
      ],
      ggcc: [
        {
          tarifaBaseUfM2: "0.45",
          pctAdministracion: "8",
          pctReajuste: "4",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          mesesReajuste: 12
        }
      ]
    } satisfies ExistingContratoForDiff;
    const existingContratos = new Map([
      [buildContratoLookupKey(existingSnapshot), existingSnapshot],
      [buildContratoLookupKey({ ...existingSnapshot, numeroContrato: "" }), existingSnapshot]
    ]);

    const preview = parseRows(
      [
        [
          "L-101",
          "76543210-k",
          "VIGENTE",
          "2026-01-01",
          "2026-12-31",
          "FIJO_UF_M2",
          "3.5",
          "2026-01-01",
          "",
          "",
          "8",
          "12",
          "5",
          "FIJO_UF_M2",
          "0.45",
          "2026-01-01",
          ""
        ]
      ],
      existingContratos
    );

    expect(preview.rows[0]?.status).toBe("UPDATED");
    expect(preview.rows[0]?.changedFields).toContain("ggccPctReajuste");
  });

  it("does not require numeroContrato in the template headers", () => {
    const preview = parseRows([
      ["L-102", "76543210-k", "VIGENTE", "2026-04-01", "2027-03-31", "FIJO_UF", "12", "2026-04-01", "", ""]
    ]);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.status).toBe("ERROR");
    expect(preview.rows[0]?.errorMessage).toContain("Local 'L-102' no existe");
  });
});
