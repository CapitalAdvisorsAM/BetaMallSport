import { describe, expect, it } from "vitest";
import { computeCostoOcupacionByTenant } from "./costo-ocupacion-per-tenant";

const UF = new Map<string, number>([
  ["2025-01", 35000],
  ["2025-02", 35000],
  ["2025-03", 35000]
]);

describe("computeCostoOcupacionByTenant", () => {
  it("returns null pct when YTD sales = 0", () => {
    const result = computeCostoOcupacionByTenant({
      tenantContracts: [{ tenantId: "t1", unitId: "u1" }],
      records: [
        {
          unitId: "u1",
          period: new Date("2025-01-01T00:00:00Z"),
          valueUf: 100
        }
      ],
      sales: [],
      ufByPeriod: UF,
      period: "2025-03"
    });
    expect(result.get("t1")).toBeNull();
  });

  it("computes YTD pct = billing / sales * 100", () => {
    const result = computeCostoOcupacionByTenant({
      tenantContracts: [{ tenantId: "t1", unitId: "u1" }],
      records: [
        {
          unitId: "u1",
          period: new Date("2025-01-01T00:00:00Z"),
          valueUf: 100
        },
        {
          unitId: "u1",
          period: new Date("2025-02-01T00:00:00Z"),
          valueUf: 100
        }
      ],
      sales: [
        {
          tenantId: "t1",
          period: new Date("2025-01-01T00:00:00Z"),
          salesPesos: 35_000_000 // 1000 UF
        },
        {
          tenantId: "t1",
          period: new Date("2025-02-01T00:00:00Z"),
          salesPesos: 35_000_000 // 1000 UF
        }
      ],
      ufByPeriod: UF,
      period: "2025-03"
    });
    // billing YTD = 200 UF, sales YTD = 2000 UF → 200/2000 * 100 = 10
    expect(result.get("t1")).toBeCloseTo(10, 4);
  });

  it("excludes records and sales outside YTD window", () => {
    const result = computeCostoOcupacionByTenant({
      tenantContracts: [{ tenantId: "t1", unitId: "u1" }],
      records: [
        // Prior year — must be excluded
        {
          unitId: "u1",
          period: new Date("2024-12-01T00:00:00Z"),
          valueUf: 9999
        },
        {
          unitId: "u1",
          period: new Date("2025-01-01T00:00:00Z"),
          valueUf: 100
        }
      ],
      sales: [
        // Prior year — must be excluded
        {
          tenantId: "t1",
          period: new Date("2024-12-01T00:00:00Z"),
          salesPesos: 999_000_000
        },
        {
          tenantId: "t1",
          period: new Date("2025-01-01T00:00:00Z"),
          salesPesos: 35_000_000
        }
      ],
      ufByPeriod: UF,
      period: "2025-03"
    });
    // Only 2025 records count: 100 UF billing / 1000 UF sales = 10%
    expect(result.get("t1")).toBeCloseTo(10, 4);
  });
});
