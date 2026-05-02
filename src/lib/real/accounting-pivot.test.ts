import { describe, expect, it } from "vitest";
import { AccountingScenario } from "@prisma/client";
import {
  buildPivotKey,
  pivotSum,
  pivotValue,
  type AccountingPivotResult
} from "@/lib/real/accounting-pivot";

function makePivot(entries: Array<{ period: string; group3: string; scenario: AccountingScenario; valueUf: number }>): AccountingPivotResult {
  const map: AccountingPivotResult = new Map();
  for (const entry of entries) {
    map.set(buildPivotKey(entry.period, entry.group3, entry.scenario), entry.valueUf);
  }
  return map;
}

describe("accounting-pivot", () => {
  describe("buildPivotKey", () => {
    it("normalizes Date and string period inputs to the same key", () => {
      const fromDate = buildPivotKey(new Date("2026-04-01T00:00:00Z"), "ARRIENDO DE LOCAL FIJO", AccountingScenario.REAL);
      const fromString = buildPivotKey("2026-04", "ARRIENDO DE LOCAL FIJO", AccountingScenario.REAL);
      expect(fromDate).toBe(fromString);
    });
  });

  describe("pivotValue", () => {
    it("returns 0 when the (period, group3, scenario) combo is missing", () => {
      const pivot = makePivot([]);
      expect(pivotValue(pivot, "2026-04", "ARRIENDO DE LOCAL FIJO", AccountingScenario.REAL)).toBe(0);
    });

    it("returns the stored value when present", () => {
      const pivot = makePivot([
        { period: "2026-04", group3: "ARRIENDO DE LOCAL FIJO", scenario: AccountingScenario.REAL, valueUf: 8500 }
      ]);
      expect(pivotValue(pivot, "2026-04", "ARRIENDO DE LOCAL FIJO", AccountingScenario.REAL)).toBe(8500);
    });

    it("isolates Real from Ppto for the same period and group3", () => {
      const pivot = makePivot([
        { period: "2026-04", group3: "ARRIENDO DE LOCAL FIJO", scenario: AccountingScenario.REAL, valueUf: 8500 },
        { period: "2026-04", group3: "ARRIENDO DE LOCAL FIJO", scenario: AccountingScenario.PPTO, valueUf: 9000 }
      ]);
      expect(pivotValue(pivot, "2026-04", "ARRIENDO DE LOCAL FIJO", AccountingScenario.REAL)).toBe(8500);
      expect(pivotValue(pivot, "2026-04", "ARRIENDO DE LOCAL FIJO", AccountingScenario.PPTO)).toBe(9000);
    });
  });

  describe("pivotSum", () => {
    it("aggregates multiple group3 buckets within a single (period, scenario)", () => {
      const pivot = makePivot([
        { period: "2026-04", group3: "ARRIENDO DE LOCAL FIJO", scenario: AccountingScenario.REAL, valueUf: 8500 },
        { period: "2026-04", group3: "ARRIENDO DE LOCAL VARIABLE", scenario: AccountingScenario.REAL, valueUf: 1200 },
        { period: "2026-04", group3: "ARRIENDO DE ESPACIO", scenario: AccountingScenario.REAL, valueUf: 800 }
      ]);
      const total = pivotSum(
        pivot,
        "2026-04",
        ["ARRIENDO DE LOCAL FIJO", "ARRIENDO DE LOCAL VARIABLE", "ARRIENDO DE ESPACIO"],
        AccountingScenario.REAL
      );
      expect(total).toBe(10500);
    });

    it("excludes other scenarios from the sum", () => {
      const pivot = makePivot([
        { period: "2026-04", group3: "ARRIENDO DE LOCAL FIJO", scenario: AccountingScenario.REAL, valueUf: 8500 },
        { period: "2026-04", group3: "ARRIENDO DE LOCAL FIJO", scenario: AccountingScenario.PPTO, valueUf: 9000 }
      ]);
      const realOnly = pivotSum(pivot, "2026-04", ["ARRIENDO DE LOCAL FIJO"], AccountingScenario.REAL);
      expect(realOnly).toBe(8500);
    });

    it("returns 0 when none of the requested group3 values match", () => {
      const pivot = makePivot([
        { period: "2026-04", group3: "ARRIENDO DE LOCAL FIJO", scenario: AccountingScenario.REAL, valueUf: 8500 }
      ]);
      const total = pivotSum(pivot, "2026-04", ["ARRIENDO DE LOCAL VARIABLE"], AccountingScenario.REAL);
      expect(total).toBe(0);
    });
  });
});
