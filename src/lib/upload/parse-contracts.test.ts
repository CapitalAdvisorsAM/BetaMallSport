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

function buildRentRollWorkbookBuffer(dataRows: unknown[][]): ArrayBuffer {
  const header = Array.from({ length: 23 }, () => "");
  header[1] = "ID Local";
  header[2] = "Numero Contrato (REF CA)";
  header[3] = "Tipo";
  header[4] = "Arrendatario";
  header[6] = "Inicio";
  header[7] = "Termino";
  header[9] = "Administracion GGCC";
  header[10] = "GGCC Final (UF/m2)";
  header[11] = "Reajuste";
  header[12] = "Meses Reajuste";
  header[15] = "% Renta Variable + IVA";
  header[17] = "Renta Fija (UF x m2) + IVA";
  header[19] = "Diciembre";
  header[21] = "Fondo Promocion (% Arriendo)";

  const sheet = utils.aoa_to_sheet([[], [], [], [], header, ...dataRows]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, "Rent Roll");

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
      multiplicadorJunio: null,
      multiplicadorJulio: null,
      multiplicadorAgosto: null,
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

  it("detects Rent Roll format and reports reconciliation without creating duplicates by REF CA", () => {
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
      multiplicadorJunio: null,
      multiplicadorJulio: null,
      multiplicadorAgosto: null,
      codigoCC: null,
      ggccPctAdministracion: null,
      notas: null,
      tarifas: [
        {
          tipo: "FIJO_UF_M2" as const,
          valor: "3.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: "2026-12-31"
        }
      ],
      ggcc: []
    } satisfies ExistingContractForDiff;
    const existingContratos = new Map<string, ExistingContractForDiff>([
      [buildContractLookupKey(existingSnapshot), existingSnapshot],
      [buildContractLookupKey({ ...existingSnapshot, numeroContrato: "" }), existingSnapshot]
    ]);

    const contractRow = Array.from({ length: 23 }, () => "");
    contractRow[1] = "L-101";
    contractRow[2] = "999";
    contractRow[3] = "Local Comercial";
    contractRow[4] = "ACME SPORT";
    contractRow[6] = "2026-01-01";
    contractRow[7] = "2026-12-31";
    contractRow[17] = "3.5";

    const vacancyConflictRow = Array.from({ length: 23 }, () => "");
    vacancyConflictRow[1] = "L-101";
    vacancyConflictRow[3] = "Local Comercial";
    vacancyConflictRow[4] = "VACANTE";
    vacancyConflictRow[6] = "2026-01-01";
    vacancyConflictRow[7] = "2026-12-31";

    const vacancyConfirmedRow = Array.from({ length: 23 }, () => "");
    vacancyConfirmedRow[1] = "L-102";
    vacancyConfirmedRow[3] = "Local Comercial";
    vacancyConfirmedRow[4] = "VACANTE";
    vacancyConfirmedRow[6] = "2026-01-01";
    vacancyConfirmedRow[7] = "2026-12-31";

    const skippedRow = Array.from({ length: 23 }, () => "");
    skippedRow[1] = "-";
    skippedRow[3] = "Local Comercial";
    skippedRow[4] = "Gestión Comercial - Nuevos Locales";

    const preview = parseContractsFile(
      buildRentRollWorkbookBuffer([contractRow, vacancyConflictRow, vacancyConfirmedRow, skippedRow]),
      {
        fileName: "20260415 Presupuesto v24.xlsb.xlsx",
        existingContratos,
        existingLocalData: new Map([
          ["L-101", { glam2: "100" }],
          ["L-102", { glam2: "100" }]
        ]),
        existingArrendatarioNombres: new Map([["acme sport", 1]])
      }
    );

    expect(preview.sourceFormat).toBe("rent_roll");
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.rowNumber).toBe(6);
    expect(preview.rows[0]?.status).toBe("UNCHANGED");
    expect(preview.summary.nuevo).toBe(0);
    expect(preview.reconciliation?.summary.matchedByNaturalKey).toBe(1);
    expect(preview.reconciliation?.summary.creatableContracts).toBe(0);
    expect(preview.reconciliation?.summary.vacancyConflicts).toBe(1);
    expect(preview.reconciliation?.summary.vacancyConfirmed).toBe(1);
    expect(preview.reconciliation?.summary.refCaMismatches).toBe(1);
    expect(preview.reconciliation?.summary.skippedRows).toBe(1);
    expect(preview.warnings).toContain(
      "Se detecto formato Rent Roll; la reconciliacion usa clave natural y REF CA solo informativo."
    );
  });

  it("maps Rent Roll percentages and supported special types into contract rows", () => {
    const row = Array.from({ length: 23 }, () => "");
    row[1] = "B-201";
    row[2] = "321";
    row[3] = "Bodega";
    row[4] = "BODEGA SPA (Outlet)";
    row[6] = "2026-02-01";
    row[7] = "2026-12-31";
    row[9] = "0.05";
    row[10] = "0.40";
    row[11] = "0.03";
    row[12] = "12";
    row[15] = "0.081";
    row[17] = "2.1";
    row[19] = "2";
    row[21] = "0.05";

    const preview = parseContractsFile(buildRentRollWorkbookBuffer([row]), {
      fileName: "rent-roll.xlsx",
      existingContratos: new Map(),
      existingLocalData: new Map([["B-201", { glam2: "25" }]]),
      existingArrendatarioNombres: new Map([["bodega spa", 1]])
    });

    expect(preview.sourceFormat).toBe("rent_roll");
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.status).toBe("NEW");
    expect(preview.rows[0]?.data.tarifaTipo).toBe("FIJO_UF_M2");
    expect(preview.rows[0]?.data.tarifaValor).toBe("2.1");
    expect(preview.rows[0]?.data.rentaVariablePct).toBe("8.1");
    expect(preview.rows[0]?.data.ggccPctAdministracion).toBe("5");
    expect(preview.rows[0]?.data.ggccPctReajuste).toBe("3");
    expect(preview.rows[0]?.data.pctFondoPromocion).toBe("5");
    expect(preview.rows[0]?.data.multiplicadorDiciembre).toBe("2");
    expect(preview.reconciliation?.summary.creatableContracts).toBe(1);
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
      multiplicadorJunio: null,
      multiplicadorJulio: null,
      multiplicadorAgosto: null,
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
      multiplicadorJunio: null,
      multiplicadorJulio: null,
      multiplicadorAgosto: null,
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
