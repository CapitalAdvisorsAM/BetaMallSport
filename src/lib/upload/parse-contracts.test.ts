import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import type { ExistingContractForDiff } from "@/lib/upload/parse-contracts";
import {
  buildContractLookupKey,
  parseContractsFile,
  revalidateContractPreviewRows
} from "@/lib/upload/parse-contracts";

function buildWorkbookBuffer(headers: string[], dataRows: string[][]): ArrayBuffer {
  const sheet = utils.aoa_to_sheet([["Plantilla de Contratos"], [], headers, ...dataRows]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Contratos");

  const output = write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  return Uint8Array.from(output).buffer;
}

function parseRows(
  dataRows: string[][],
  existingContratos: Map<string, ExistingContractForDiff> = new Map()
) {
  return parseContractsFile(
    buildWorkbookBuffer(
      [
        "localcodigo",
        "arrendatarionombre",
        "fechainicio",
        "fechatermino",
        "tarifatipo",
        "tarifavalor",
        "tarifavigenciadesde",
        "tarifavigenciahasta",
        "rentavariablepct",
        "multiplicadordiciembre",
        "ggccpctadministracion",
        "ggccmesesreajuste",
        "ggccpctreajuste",
        "ggcctipo",
        "ggccvalor"
      ],
      dataRows
    ),
    {
      existingContratos,
      existingLocalData: new Map([["L-101", { glam2: "100" }]]),
      existingArrendatarioNombres: new Map([["acme sport", 1]])
    }
  );
}

describe("parseContractsFile", () => {
  it("uses contract dates automatically for renta variable loaded via rentaVariablePct", () => {
    const preview = parseRows([
      ["L-101", "ACME SPORT", "2026-01-01", "2026-12-31", "", "", "", "", "5.5", ""]
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
      ["L-101", "ACME SPORT", "2026-03-01", "2027-02-28", "PORCENTAJE", "7", "", "", "", ""]
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
        "ACME SPORT",
        "2026-01-01",
        "2026-12-31",
        "FIJO_UF_M2",
        "3.5",
        "2026-01-01",
        "",
        "",
        "",
        "8",
        "12",
        "5",
        "FIJO_UF_M2",
        "0.45"
      ]
    ]);

    expect(preview.rows[0]?.status).toBe("NEW");
    expect(preview.rows[0]?.data.ggccPctReajuste).toBe("5");
  });

  it("rejects GGCC months without pctReajuste", () => {
    const preview = parseRows([
      [
        "L-101",
        "ACME SPORT",
        "2026-01-01",
        "2026-12-31",
        "FIJO_UF_M2",
        "3.5",
        "2026-01-01",
        "",
        "",
        "",
        "8",
        "12",
        "",
        "FIJO_UF_M2",
        "0.45"
      ]
    ]);

    expect(preview.rows[0]?.status).toBe("ERROR");
    expect(preview.rows[0]?.errorMessage).toContain("ggccPctReajuste");
  });

  it("marks row as updated when only ggccPctReajuste changes", () => {
    const existingSnapshot = {
      numeroContrato: "C-400",
      localCodigo: "L-101",
      arrendatarioNombre: "ACME SPORT",
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      fechaEntrega: null,
      fechaApertura: null,
      pctFondoPromocion: null,
      multiplicadorDiciembre: null,
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
          mesesReajuste: 12
        }
      ]
    } satisfies ExistingContractForDiff;
    const existingContratos = new Map([
      [buildContractLookupKey(existingSnapshot), existingSnapshot],
      [buildContractLookupKey({ ...existingSnapshot, numeroContrato: "" }), existingSnapshot]
    ]);

    const preview = parseRows(
      [
        [
          "L-101",
          "ACME SPORT",
          "2026-01-01",
          "2026-12-31",
          "FIJO_UF_M2",
          "3.5",
          "2026-01-01",
          "",
          "",
          "",
          "8",
          "12",
          "5",
          "FIJO_UF_M2",
          "0.45"
        ]
      ],
      existingContratos
    );

    expect(preview.rows[0]?.status).toBe("UPDATED");
    expect(preview.rows[0]?.changedFields).toContain("ggccPctReajuste");
  });

  it("does not require numeroContrato in the template headers", () => {
    const preview = parseRows([
      ["L-102", "ACME SPORT", "2026-04-01", "2027-03-31", "FIJO_UF", "12", "2026-04-01", "", "", ""]
    ]);

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.status).toBe("ERROR");
    expect(preview.rows[0]?.errorMessage).toContain("Local 'L-102' no existe");
  });

  it("returns ambiguity error when arrendatarioNombre has duplicates in project", () => {
    const preview = parseContractsFile(
      buildWorkbookBuffer(
        [
          "localcodigo",
          "arrendatarionombre",
          "fechainicio",
          "fechatermino",
          "tarifatipo",
          "tarifavalor",
          "tarifavigenciadesde"
        ],
        [["L-101", "ACME SPORT", "2026-01-01", "2026-12-31", "FIJO_UF_M2", "3.5", "2026-01-01"]]
      ),
      {
        existingContratos: new Map(),
        existingLocalData: new Map([["L-101", { glam2: "100" }]]),
        existingArrendatarioNombres: new Map([["acme sport", 2]])
      }
    );

    expect(preview.rows[0]?.status).toBe("ERROR");
    expect(preview.rows[0]?.errorMessage).toContain("es ambiguo");
  });
});

describe("revalidateContractPreviewRows", () => {
  function makeBaseRowData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      numeroContrato: "",
      localCodigo: "L-101",
      arrendatarioNombre: "ACME SPORT",
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      fechaEntrega: null,
      fechaApertura: null,
      tarifaTipo: "FIJO_UF_M2",
      tarifaValor: "3.5",
      tarifaVigenciaDesde: "2026-01-01",
      tarifaVigenciaHasta: null,
      pctFondoPromocion: null,
      multiplicadorDiciembre: null,
      codigoCC: null,
      ggccPctAdministracion: null,
      ggccPctReajuste: null,
      notas: null,
      ggccTipo: null,
      ggccValor: null,
      ggccMesesReajuste: null,
      anexoFecha: null,
      anexoDescripcion: null,
      ...overrides
    };
  }

  const revalidateOptions = {
    existingContratos: new Map<string, ExistingContractForDiff>(),
    existingLocalData: new Map([["L-101", { glam2: "100" }]]),
    existingArrendatarioNombres: new Map([["acme sport", 1]])
  };

  it("revalidates all rows and flags duplicates created by editing one row", () => {
    const preview = revalidateContractPreviewRows(
      [
        { rowNumber: 2, data: makeBaseRowData() },
        { rowNumber: 3, data: makeBaseRowData({ tarifaVigenciaDesde: "2026-01-01" }) }
      ],
      revalidateOptions
    );

    expect(preview.rows[0]?.status).toBe("NEW");
    expect(preview.rows[1]?.status).toBe("ERROR");
    expect(preview.rows[1]?.errorMessage).toContain("Tarifa duplicada");
    expect(preview.summary.errores).toBe(1);
  });

  it("turns an ERROR row into NEW when edited with valid values", () => {
    const preview = revalidateContractPreviewRows(
      [
        {
          rowNumber: 2,
          data: makeBaseRowData({ arrendatarioNombre: "NO EXISTE" })
        }
      ],
      revalidateOptions
    );

    expect(preview.rows[0]?.status).toBe("ERROR");

    const fixedPreview = revalidateContractPreviewRows(
      [
        {
          rowNumber: 2,
          data: makeBaseRowData({ arrendatarioNombre: "ACME SPORT" })
        }
      ],
      revalidateOptions
    );

    expect(fixedPreview.rows[0]?.status).toBe("NEW");
    expect(fixedPreview.summary.errores).toBe(0);
  });

  it("marks row as UPDATED and recalculates summary when edited against existing contract", () => {
    const existingSnapshot = {
      numeroContrato: "C-200",
      localCodigo: "L-101",
      arrendatarioNombre: "ACME SPORT",
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31",
      fechaEntrega: null,
      fechaApertura: null,
      pctFondoPromocion: null,
      multiplicadorDiciembre: null,
      codigoCC: null,
      ggccPctAdministracion: null,
      notas: null,
      tarifas: [
        {
          tipo: "FIJO_UF_M2" as const,
          valor: "3.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null
        }
      ],
      ggcc: []
    } satisfies ExistingContractForDiff;

    const existingContratos = new Map<string, ExistingContractForDiff>([
      [buildContractLookupKey(existingSnapshot), existingSnapshot]
    ]);

    const preview = revalidateContractPreviewRows(
      [
        {
          rowNumber: 2,
          data: makeBaseRowData({ numeroContrato: "C-200", tarifaValor: "4.2" })
        }
      ],
      {
        ...revalidateOptions,
        existingContratos
      }
    );

    expect(preview.rows[0]?.status).toBe("UPDATED");
    expect(preview.rows[0]?.changedFields).toContain("tarifaValor");
    expect(preview.summary.actualizado).toBe(1);
  });
});
