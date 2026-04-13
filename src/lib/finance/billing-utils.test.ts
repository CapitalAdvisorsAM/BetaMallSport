import { describe, expect, it } from "vitest";
import { shiftPeriod, calcVariableRent, calcTieredVariableRent } from "./billing-utils";

describe("shiftPeriod", () => {
  it("shifts forward by 1 month", () => {
    expect(shiftPeriod("2025-03", 1)).toBe("2025-04");
  });

  it("shifts backward by 1 month", () => {
    expect(shiftPeriod("2025-04", -1)).toBe("2025-03");
  });

  it("handles year rollover forward (Dec → Jan)", () => {
    expect(shiftPeriod("2024-12", 1)).toBe("2025-01");
  });

  it("handles year rollover backward (Jan → Dec)", () => {
    expect(shiftPeriod("2025-01", -1)).toBe("2024-12");
  });

  it("shifts by multiple months", () => {
    expect(shiftPeriod("2025-01", -3)).toBe("2024-10");
  });

  it("handles shift of 0", () => {
    expect(shiftPeriod("2025-06", 0)).toBe("2025-06");
  });
});

describe("calcVariableRent", () => {
  it("returns excess over fixed rent when variable exceeds fixed", () => {
    // sales=1000, pct=10% → raw variable = 100, fixed = 60 → excess = 40
    expect(calcVariableRent(1000, 10, 60)).toBe(40);
  });

  it("returns 0 when variable does not exceed fixed rent", () => {
    // sales=500, pct=10% → raw variable = 50, fixed = 60 → excess = -10 → 0
    expect(calcVariableRent(500, 10, 60)).toBe(0);
  });

  it("returns full variable when fixed rent is 0", () => {
    // sales=1000, pct=5% → raw variable = 50, fixed = 0 → excess = 50
    expect(calcVariableRent(1000, 5, 0)).toBe(50);
  });

  it("returns 0 when sales are 0", () => {
    expect(calcVariableRent(0, 10, 60)).toBe(0);
  });

  it("clamps negative result to 0", () => {
    expect(calcVariableRent(100, 5, 100)).toBe(0);
  });

  it("handles exact equality (variable equals fixed)", () => {
    // sales=1000, pct=10% → raw = 100, fixed = 100 → 0
    expect(calcVariableRent(1000, 10, 100)).toBe(0);
  });
});

describe("calcTieredVariableRent", () => {
  it("single tier (backward compat) matches calcVariableRent", () => {
    const tiers = [{ umbralVentasUf: 0, pct: 10 }];
    expect(calcTieredVariableRent(1000, tiers, 60)).toBe(calcVariableRent(1000, 10, 60));
  });

  it("two tiers, sales in base tier", () => {
    const tiers = [
      { umbralVentasUf: 0, pct: 5 },
      { umbralVentasUf: 1000, pct: 7 }
    ];
    // sales=500 → qualifies for base tier (0), pct=5%
    // 500 * 5/100 - 20 = 5
    expect(calcTieredVariableRent(500, tiers, 20)).toBe(5);
  });

  it("two tiers, sales in second tier", () => {
    const tiers = [
      { umbralVentasUf: 0, pct: 5 },
      { umbralVentasUf: 1000, pct: 7 }
    ];
    // sales=1500 → qualifies for tier 1000, pct=7%
    // 1500 * 7/100 - 20 = 105 - 20 = 85
    expect(calcTieredVariableRent(1500, tiers, 20)).toBeCloseTo(85, 4);
  });

  it("three tiers, sales in top tier", () => {
    const tiers = [
      { umbralVentasUf: 0, pct: 5 },
      { umbralVentasUf: 1000, pct: 7 },
      { umbralVentasUf: 2000, pct: 10 }
    ];
    // sales=2500 → qualifies for tier 2000, pct=10%
    // 2500 * 10/100 - 50 = 250 - 50 = 200
    expect(calcTieredVariableRent(2500, tiers, 50)).toBe(200);
  });

  it("sales exactly at threshold boundary (inclusive)", () => {
    const tiers = [
      { umbralVentasUf: 0, pct: 5 },
      { umbralVentasUf: 1000, pct: 7 }
    ];
    // sales=1000 → exactly at threshold → qualifies for tier 1000
    // 1000 * 7/100 - 20 = 70 - 20 = 50
    expect(calcTieredVariableRent(1000, tiers, 20)).toBe(50);
  });

  it("returns 0 when sales below all thresholds", () => {
    const tiers = [
      { umbralVentasUf: 500, pct: 5 },
      { umbralVentasUf: 1000, pct: 7 }
    ];
    // sales=200 → below all thresholds → 0
    expect(calcTieredVariableRent(200, tiers, 0)).toBe(0);
  });

  it("returns 0 when tiers array is empty", () => {
    expect(calcTieredVariableRent(1000, [], 50)).toBe(0);
  });

  it("clamps to 0 when fixed rent exceeds variable", () => {
    const tiers = [{ umbralVentasUf: 0, pct: 5 }];
    // sales=100, 5% → 5, fixed=100 → -95 → clamped to 0
    expect(calcTieredVariableRent(100, tiers, 100)).toBe(0);
  });
});
