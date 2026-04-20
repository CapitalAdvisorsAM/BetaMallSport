import { describe, expect, it } from "vitest";
import { ContractStatus } from "@prisma/client";
import {
  shiftPeriod,
  calcVariableRent,
  calcTieredVariableRent,
  calcExpectedIncome,
  type RateEntry
} from "./billing-utils";

function baseFixedRate(overrides: Partial<RateEntry> = {}): RateEntry {
  return {
    tipo: "FIJO_UF_M2",
    valor: "1",
    umbralVentasUf: null,
    pisoMinimoUf: null,
    vigenciaDesde: new Date("2026-01-01"),
    vigenciaHasta: new Date("2028-12-31"),
    esDiciembre: false,
    descuentoTipo: null,
    descuentoValor: null,
    descuentoDesde: null,
    descuentoHasta: null,
    ...overrides
  };
}

function callExpected(
  overrides: Partial<Parameters<typeof calcExpectedIncome>[0]> = {}
): ReturnType<typeof calcExpectedIncome> {
  return calcExpectedIncome({
    tarifas: [baseFixedRate()],
    ggcc: [],
    glam2: 100,
    multiplicadorDiciembre: null,
    multiplicadorJunio: null,
    multiplicadorJulio: null,
    multiplicadorAgosto: null,
    pctFondoPromocion: null,
    periodDate: new Date("2026-06-01"),
    ...overrides
  });
}

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

describe("calcExpectedIncome — estado GRACIA", () => {
  it("returns all zeros when estado === GRACIA", () => {
    const result = callExpected({
      estado: ContractStatus.GRACIA,
      ggcc: [
        {
          tarifaBaseUfM2: "0.5",
          pctAdministracion: "10",
          vigenciaDesde: new Date("2026-01-01"),
          vigenciaHasta: null
        }
      ],
      pctFondoPromocion: 5
    });
    expect(result.fixedRentUf).toBe(0);
    expect(result.ggccUf).toBe(0);
    expect(result.fondoUf).toBe(0);
    expect(result.variableRentUf).toBe(0);
    expect(result.totalUf).toBe(0);
  });

  it("computes normally when estado === VIGENTE", () => {
    const result = callExpected({ estado: ContractStatus.VIGENTE });
    // valor=1, glam2=100 → 100
    expect(result.fixedRentUf).toBe(100);
    expect(result.totalUf).toBe(100);
  });

  it("defaults to computing when estado is undefined", () => {
    const result = callExpected();
    expect(result.fixedRentUf).toBe(100);
  });
});

describe("calcExpectedIncome — multiplicadores estacionales", () => {
  it("applies multiplicadorJunio only in June", () => {
    const result = callExpected({
      periodDate: new Date("2026-06-01"),
      multiplicadorJunio: 1.5
    });
    // 1 * 100 * 1.5 = 150
    expect(result.fixedRentUf).toBe(150);
  });

  it("applies multiplicadorJulio only in July", () => {
    const result = callExpected({
      periodDate: new Date("2026-07-01"),
      multiplicadorJulio: 2
    });
    expect(result.fixedRentUf).toBe(200);
  });

  it("applies multiplicadorAgosto only in August", () => {
    const result = callExpected({
      periodDate: new Date("2026-08-01"),
      multiplicadorAgosto: 1.25
    });
    expect(result.fixedRentUf).toBe(125);
  });

  it("applies multiplicadorDiciembre on regular rate when no esDiciembre rate exists", () => {
    const result = callExpected({
      periodDate: new Date("2026-12-01"),
      multiplicadorDiciembre: 1.5
    });
    expect(result.fixedRentUf).toBe(150);
  });

  it("does not apply June multiplier outside June", () => {
    const result = callExpected({
      periodDate: new Date("2026-05-01"),
      multiplicadorJunio: 1.5
    });
    expect(result.fixedRentUf).toBe(100);
  });
});

describe("calcExpectedIncome — esDiciembre + multiplicadorDiciembre", () => {
  it("uses esDiciembre rate in December when multiplier is set (no further multiplier on dec rate)", () => {
    const regular = baseFixedRate({ valor: "1" });
    const december = baseFixedRate({ valor: "1.5", esDiciembre: true });
    const result = callExpected({
      tarifas: [regular, december],
      periodDate: new Date("2026-12-01"),
      multiplicadorDiciembre: 2
    });
    // esDiciembre rate found → uses 1.5 * glam2, NOT multiplied
    expect(result.fixedRentUf).toBe(150);
  });

  it("applies only multiplier when there is no esDiciembre rate", () => {
    const regular = baseFixedRate({ valor: "1" });
    const result = callExpected({
      tarifas: [regular],
      periodDate: new Date("2026-12-01"),
      multiplicadorDiciembre: 1.5
    });
    // no esDiciembre rate → 1 * 100 * 1.5 = 150
    expect(result.fixedRentUf).toBe(150);
  });

  it("ignores esDiciembre rate when multiplier is null (no december logic triggered)", () => {
    const regular = baseFixedRate({ valor: "1" });
    const december = baseFixedRate({ valor: "1.5", esDiciembre: true });
    const result = callExpected({
      tarifas: [regular, december],
      periodDate: new Date("2026-12-01"),
      multiplicadorDiciembre: null
    });
    // multiplier is null → skips december branch → uses regular rate: 1 * 100 = 100
    expect(result.fixedRentUf).toBe(100);
  });
});

describe("calcExpectedIncome — discounts", () => {
  it("applies PORCENTAJE discount when period is within discount window", () => {
    const result = callExpected({
      tarifas: [
        baseFixedRate({
          valor: "1",
          descuentoTipo: "PORCENTAJE",
          descuentoValor: "0.2",
          descuentoDesde: new Date("2026-01-01"),
          descuentoHasta: new Date("2026-06-30")
        })
      ],
      periodDate: new Date("2026-03-01")
    });
    // 1 * 0.8 * 100 = 80
    expect(result.fixedRentUf).toBeCloseTo(80, 4);
  });

  it("applies MONTO_UF discount per m² (clamped non-negative)", () => {
    const result = callExpected({
      tarifas: [
        baseFixedRate({
          valor: "1",
          descuentoTipo: "MONTO_UF",
          descuentoValor: "0.3",
          descuentoDesde: new Date("2026-01-01"),
          descuentoHasta: new Date("2026-12-31")
        })
      ],
      periodDate: new Date("2026-03-01")
    });
    // (1 - 0.3) * 100 = 70
    expect(result.fixedRentUf).toBeCloseTo(70, 4);
  });

  it("does not apply discount outside the window", () => {
    const result = callExpected({
      tarifas: [
        baseFixedRate({
          valor: "1",
          descuentoTipo: "PORCENTAJE",
          descuentoValor: "0.2",
          descuentoDesde: new Date("2026-01-01"),
          descuentoHasta: new Date("2026-03-31")
        })
      ],
      periodDate: new Date("2026-06-01")
    });
    // outside window → no discount → 100
    expect(result.fixedRentUf).toBe(100);
  });
});

