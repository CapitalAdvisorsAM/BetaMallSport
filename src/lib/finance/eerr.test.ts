import { describe, expect, it } from "vitest";
import { buildEerrData, calculateEbitdaMargin, COST_GROUPS } from "@/lib/finance/eerr";

describe("buildEerrData", () => {
  it("groups sections and lines by period while calculating EBITDA", () => {
    const result = buildEerrData([
      {
        grupo1: "INGRESOS DE EXPLOTACION",
        grupo3: "Renta Fija",
        periodo: new Date("2026-01-01T00:00:00.000Z"),
        valorUf: 100
      },
      {
        grupo1: "INGRESOS DE EXPLOTACION",
        grupo3: "Renta Variable",
        periodo: new Date("2026-01-01T00:00:00.000Z"),
        valorUf: 20
      },
      {
        grupo1: "GASTOS MARKETING",
        grupo3: "Campanas",
        periodo: new Date("2026-01-01T00:00:00.000Z"),
        valorUf: 10
      },
      {
        grupo1: "INGRESOS DE EXPLOTACION",
        grupo3: "Renta Fija",
        periodo: new Date("2026-02-01T00:00:00.000Z"),
        valorUf: 80
      }
    ]);

    expect(result.periodos).toEqual(["2026-01", "2026-02"]);
    expect(result.secciones).toHaveLength(2);
    expect(result.secciones[0]?.porPeriodo["2026-01"]).toBe(120);
    expect(result.secciones[0]?.lineas).toHaveLength(2);
    expect(result.ebitda.porPeriodo["2026-01"]).toBe(130);
    expect(result.ebitda.total).toBe(210);
  });
});

describe("calculateEbitdaMargin", () => {
  it("returns null when ingresos are zero", () => {
    expect(calculateEbitdaMargin(0, 10)).toBeNull();
  });

  it("returns a percentage when ingresos exist", () => {
    expect(calculateEbitdaMargin(200, 50)).toBe(25);
  });
});

describe("COST_GROUPS", () => {
  it("marks known cost groups", () => {
    expect(COST_GROUPS.has("GASTOS MARKETING")).toBe(true);
  });
});

