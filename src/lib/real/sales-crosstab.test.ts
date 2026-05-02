import { describe, expect, it } from "vitest";
import { UnitType } from "@prisma/client";
import { buildSalesCrosstab } from "./sales-crosstab";

const UF = new Map<string, number>([["2025-01", 35000]]);

const UNITS = [
  {
    id: "u1",
    tipo: UnitType.LOCAL_COMERCIAL,
    esGLA: true,
    glam2: 100,
    piso: "1",
    categoriaTamano: "Tienda Mayor",
    zona: null
  },
  {
    id: "u2",
    tipo: UnitType.LOCAL_COMERCIAL,
    esGLA: true,
    glam2: 50,
    piso: "2",
    categoriaTamano: "Tienda Menor",
    zona: null
  }
];

const CONTRACTS = [
  {
    localId: "u1",
    arrendatarioId: "t1",
    fechaInicio: new Date("2024-01-01T00:00:00Z"),
    fechaTermino: new Date("2030-12-31T00:00:00Z")
  },
  {
    localId: "u2",
    arrendatarioId: "t2",
    fechaInicio: new Date("2024-01-01T00:00:00Z"),
    fechaTermino: new Date("2030-12-31T00:00:00Z")
  }
];

describe("buildSalesCrosstab", () => {
  it("totals reconcile across rows, cols, and grand total", () => {
    const result = buildSalesCrosstab({
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 35_000_000 },
        { tenantId: "t2", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 70_000_000 }
      ],
      priorSales: null,
      contracts: CONTRACTS,
      units: UNITS,
      periods: ["2025-01"],
      rowDim: "tamano",
      colDim: "piso",
      ufByPeriod: UF
    });

    let cellSum = 0;
    for (const row of result.cells) for (const cell of row) cellSum += cell.salesUf;

    const rowSum = result.rowTotals.reduce((s, r) => s + r.salesUf, 0);
    const colSum = result.colTotals.reduce((s, c) => s + c.salesUf, 0);

    expect(rowSum).toBeCloseTo(cellSum, 4);
    expect(colSum).toBeCloseTo(cellSum, 4);
    expect(result.grandTotal.salesUf).toBeCloseTo(cellSum, 4);
  });

  it("emits one row per unique row dimension and one col per unique col dimension", () => {
    const result = buildSalesCrosstab({
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 35_000_000 },
        { tenantId: "t2", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 70_000_000 }
      ],
      priorSales: null,
      contracts: CONTRACTS,
      units: UNITS,
      periods: ["2025-01"],
      rowDim: "tamano",
      colDim: "piso",
      ufByPeriod: UF
    });
    expect(result.rows.sort()).toEqual(["Tienda Mayor", "Tienda Menor"].sort());
    expect(result.cols.sort()).toEqual(["1", "2"]);
  });

  it("share % across all cells sums to ~100%", () => {
    const result = buildSalesCrosstab({
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 35_000_000 },
        { tenantId: "t2", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 70_000_000 }
      ],
      priorSales: null,
      contracts: CONTRACTS,
      units: UNITS,
      periods: ["2025-01"],
      rowDim: "tamano",
      colDim: "piso",
      ufByPeriod: UF
    });
    let sharesSum = 0;
    for (const row of result.cells) {
      for (const cell of row) {
        if (cell.sharePct !== null && cell.salesUf > 0) sharesSum += cell.sharePct;
      }
    }
    expect(sharesSum).toBeCloseTo(100, 1);
  });
});
