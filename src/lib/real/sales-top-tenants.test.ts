import { describe, expect, it } from "vitest";
import { buildTopTenants } from "./sales-top-tenants";

const UF = new Map<string, number>([
  ["2024-01", 30000],
  ["2025-01", 35000]
]);

const CONTRACTS = [
  {
    arrendatarioId: "t1",
    localId: "u1",
    fechaInicio: new Date("2024-01-01T00:00:00Z"),
    fechaTermino: new Date("2030-12-31T00:00:00Z")
  },
  {
    arrendatarioId: "t2",
    localId: "u2",
    fechaInicio: new Date("2024-01-01T00:00:00Z"),
    fechaTermino: new Date("2030-12-31T00:00:00Z")
  }
];

const UNITS = [
  { id: "u1", glam2: 100, esGLA: true },
  { id: "u2", glam2: 50, esGLA: true }
];

describe("buildTopTenants", () => {
  it("orders by Ventas UF descending", () => {
    const rows = buildTopTenants({
      tenants: [
        { id: "t1", nombreComercial: "Alpha" },
        { id: "t2", nombreComercial: "Beta" }
      ],
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 35_000_000 },
        { tenantId: "t2", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 105_000_000 }
      ],
      priorSales: [],
      ytdSales: [],
      contracts: CONTRACTS,
      units: UNITS,
      records: [],
      ufByPeriod: UF,
      periods: ["2025-01"],
      hastaPeriod: "2025-01",
      limit: 10
    });
    expect(rows.map((r) => r.nombreComercial)).toEqual(["Beta", "Alpha"]);
    // Beta UF = 105M / 35K = 3000; Alpha = 1000
    expect(rows[0].ventasUf).toBeCloseTo(3000, 2);
    expect(rows[1].ventasUf).toBeCloseTo(1000, 2);
  });

  it("YoY null when prior sales = 0", () => {
    const rows = buildTopTenants({
      tenants: [{ id: "t1", nombreComercial: "Alpha" }],
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 35_000_000 }
      ],
      priorSales: [],
      ytdSales: [],
      contracts: CONTRACTS,
      units: UNITS,
      records: [],
      ufByPeriod: UF,
      periods: ["2025-01"],
      hastaPeriod: "2025-01",
      limit: 10
    });
    expect(rows[0].yoyPct).toBeNull();
  });

  it("computes UF/m² from assigned GLA", () => {
    const rows = buildTopTenants({
      tenants: [{ id: "t1", nombreComercial: "Alpha" }],
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 35_000_000 }
      ],
      priorSales: [],
      ytdSales: [],
      contracts: CONTRACTS,
      units: UNITS,
      records: [],
      ufByPeriod: UF,
      periods: ["2025-01"],
      hastaPeriod: "2025-01",
      limit: 10
    });
    // 1000 UF / 100 m² = 10
    expect(rows[0].ufPerM2).toBeCloseTo(10, 2);
  });

  it("respects limit", () => {
    const rows = buildTopTenants({
      tenants: [
        { id: "t1", nombreComercial: "Alpha" },
        { id: "t2", nombreComercial: "Beta" }
      ],
      sales: [
        { tenantId: "t1", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 35_000_000 },
        { tenantId: "t2", period: new Date("2025-01-01T00:00:00Z"), salesPesos: 70_000_000 }
      ],
      priorSales: [],
      ytdSales: [],
      contracts: CONTRACTS,
      units: UNITS,
      records: [],
      ufByPeriod: UF,
      periods: ["2025-01"],
      hastaPeriod: "2025-01",
      limit: 1
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].nombreComercial).toBe("Beta");
  });
});
