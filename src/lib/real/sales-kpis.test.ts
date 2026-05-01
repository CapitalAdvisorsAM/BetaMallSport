import { describe, expect, it } from "vitest";
import { buildSalesKpis } from "./sales-kpis";

const UNIT_A = { id: "u1", glam2: 100, dimensionValue: "Tienda Mayor" };
const UNIT_B = { id: "u2", glam2: 50, dimensionValue: "Tienda Menor" };

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

const PERIODS = ["2025-01", "2025-02"];

const UF = new Map<string, number>([
  ["2024-01", 30000],
  ["2024-02", 30000],
  ["2025-01", 35000],
  ["2025-02", 35000]
]);

const GLA_OCCUPIED = new Map<string, Map<string, number>>([
  [
    "Tienda Mayor",
    new Map([
      ["2025-01", 100],
      ["2025-02", 100]
    ])
  ],
  [
    "Tienda Menor",
    new Map([
      ["2025-01", 50],
      ["2025-02", 50]
    ])
  ]
]);

describe("buildSalesKpis", () => {
  it("returns YoY null when prior sales sum is zero", () => {
    const result = buildSalesKpis({
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 70_000_000 }
      ],
      priorSales: [],
      contracts: CONTRACTS,
      units: [UNIT_A, UNIT_B],
      periods: PERIODS,
      glaOccupied: GLA_OCCUPIED,
      ufByPeriod: UF
    });
    expect(result.yoyPct).toBeNull();
  });

  it("computes YoY % from prior-year sales", () => {
    const result = buildSalesKpis({
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 70_000_000 }
      ],
      priorSales: [
        { tenantId: "t1", period: new Date("2024-01-01T00:00:00Z"), salesPesos: 30_000_000 }
      ],
      contracts: CONTRACTS,
      units: [UNIT_A, UNIT_B],
      periods: PERIODS,
      glaOccupied: GLA_OCCUPIED,
      ufByPeriod: UF
    });
    // ventasUfTotal = 70_000_000 / 35_000 = 2000 UF
    // ventasUfPrior = 30_000_000 / 30_000 = 1000 UF
    // YoY = ((2000 - 1000) / 1000) * 100 = 100%
    expect(result.ventasUfTotal).toBeCloseTo(2000, 2);
    expect(result.yoyPct).toBeCloseTo(100, 2);
  });

  it("counts only locales with positive sales", () => {
    const result = buildSalesKpis({
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 70_000_000 }
      ],
      priorSales: [],
      contracts: CONTRACTS,
      units: [UNIT_A, UNIT_B],
      periods: PERIODS,
      glaOccupied: GLA_OCCUPIED,
      ufByPeriod: UF
    });
    expect(result.localesConVentas).toBe(1);
  });

  it("UF/m² promedio mensual is mean of monthly ratios, not total/total", () => {
    const sales = [
      { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 35_000_000 },
      { tenantId: "t1", period: new Date("2025-02-01T00:00:00Z"), salesPesos: 70_000_000 }
    ];
    // Month 1: 35M/35K = 1000 UF / 150 m² (total occupied) = 6.667 UF/m²
    // Month 2: 70M/35K = 2000 UF / 150 = 13.333 UF/m²
    // Mean of ratios = (6.667 + 13.333) / 2 = 10.0
    // Total/total would also be 3000/300 = 10.0 here, so make GLA differ:
    const glaVarying = new Map<string, Map<string, number>>([
      [
        "Tienda Mayor",
        new Map([
          ["2025-01", 100],
          ["2025-02", 200]
        ])
      ],
      [
        "Tienda Menor",
        new Map([
          ["2025-01", 50],
          ["2025-02", 50]
        ])
      ]
    ]);
    const result = buildSalesKpis({
      sales,
      priorSales: [],
      contracts: CONTRACTS,
      units: [UNIT_A, UNIT_B],
      periods: PERIODS,
      glaOccupied: glaVarying,
      ufByPeriod: UF
    });
    // Month 1 ratio: 1000 / (100+50) = 6.6667
    // Month 2 ratio: 2000 / (200+50) = 8.0
    // Mean = (6.6667 + 8.0) / 2 = 7.3333
    // Total/total = (1000+2000) / (150+250) = 7.5 (different!)
    expect(result.ufPerM2MensualPromedio).toBeCloseTo(7.3333, 2);
  });
});
