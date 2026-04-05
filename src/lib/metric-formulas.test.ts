import { describe, expect, it } from "vitest";
import { METRIC_FORMULAS } from "@/lib/metric-formulas";

describe("METRIC_FORMULAS", () => {
  it("defines a non-empty formula and detail for every metric id", () => {
    const entries = Object.entries(METRIC_FORMULAS);
    expect(entries.length).toBeGreaterThan(0);

    for (const [metricId, definition] of entries) {
      expect(metricId.trim().length).toBeGreaterThan(0);
      expect(definition.formula.trim().length).toBeGreaterThan(0);
      expect(definition.detail.trim().length).toBeGreaterThan(0);
    }
  });
});
