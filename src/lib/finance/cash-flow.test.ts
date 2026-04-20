import { describe, expect, it } from "vitest";
import { buildCashFlow } from "./cash-flow";

describe("buildCashFlow", () => {
  it("aggregates bank movements by classification and period", () => {
    const result = buildCashFlow([
      {
        period: new Date("2025-02-01T00:00:00Z"),
        classification: "Ingresos Bco",
        amountClp: 1000,
      },
      {
        period: new Date("2025-02-01T00:00:00Z"),
        classification: "Ingresos Bco",
        amountClp: 2000,
      },
      {
        period: new Date("2025-03-01T00:00:00Z"),
        classification: "Arriendo terceros",
        amountClp: 500,
      },
    ]);

    expect(result.periods).toEqual(["2025-02", "2025-03"]);
    expect(result.sections[0]?.classification).toBe("Ingresos Bco");
    expect(result.inflowsByPeriod["2025-02"]).toBe(3000);
    expect(result.cumulativeByPeriod["2025-03"]).toBe(3500);
  });
});
