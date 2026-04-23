import { describe, expect, it } from "vitest";
import { buildEeff } from "./eeff";

describe("buildEeff", () => {
  it("groups records by group, category and account", () => {
    const result = buildEeff([
      {
        period: new Date("2025-06-01T00:00:00Z"),
        groupName: "Activos Corrientes",
        category: "Efectivo y equivalentes al efectivo",
        accountCode: "110101",
        accountName: "Caja",
        valueUf: -3.71,
      },
      {
        period: new Date("2025-06-01T00:00:00Z"),
        groupName: "Pasivos Corrientes",
        category: "Proveedores",
        accountCode: "210101",
        accountName: "Cuentas por pagar",
        valueUf: 12.5,
      },
    ]);

    expect(result.periods).toEqual(["2025-06"]);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]?.group).toBe("Activos Corrientes");
    expect(result.groups[0]?.categories[0]?.lines[0]?.accountCode).toBe("110101");
    expect(result.liquidityByPeriod["2025-06"]).toBeCloseTo(-3.71);
  });
});
