import { describe, expect, it } from "vitest";
import { buildPanelKpi, safeDivide, toPanelCell, yoyPct } from "./panel-kpis";

describe("yoyPct", () => {
  it("retorna null cuando prior es 0", () => {
    expect(yoyPct(100, 0)).toBeNull();
  });

  it("retorna null cuando cualquiera es null", () => {
    expect(yoyPct(null, 100)).toBeNull();
    expect(yoyPct(100, null)).toBeNull();
  });

  it("calcula porcentaje relativo a |prior|", () => {
    expect(yoyPct(110, 100)).toBeCloseTo(10, 5);
    expect(yoyPct(80, 100)).toBeCloseTo(-20, 5);
    expect(yoyPct(-50, -100)).toBeCloseTo(50, 5);
  });
});

describe("safeDivide", () => {
  it("retorna null cuando denominador es <= 0", () => {
    expect(safeDivide(100, 0)).toBeNull();
    expect(safeDivide(100, -5)).toBeNull();
  });

  it("retorna null cuando numerador es null", () => {
    expect(safeDivide(null, 100)).toBeNull();
  });

  it("divide cuando ambos son validos", () => {
    expect(safeDivide(200, 50)).toBe(4);
  });
});

describe("toPanelCell", () => {
  it("arma celda con real/ppto/yoy", () => {
    const cell = toPanelCell({ real: 110, ppto: 100, prior: 100 });
    expect(cell.real).toBe(110);
    expect(cell.ppto).toBe(100);
    expect(cell.yoy).toBeCloseTo(10, 5);
  });

  it("defaults ppto a null cuando no se pasa", () => {
    const cell = toPanelCell({ real: 50, prior: 40 });
    expect(cell.ppto).toBeNull();
    expect(cell.yoy).toBeCloseTo(25, 5);
  });

  it("yoy null si falta prior", () => {
    const cell = toPanelCell({ real: 50 });
    expect(cell.yoy).toBeNull();
  });
});

describe("buildPanelKpi", () => {
  it("arma KPI completo con mes, ytd y seccion", () => {
    const kpi = buildPanelKpi(
      "facturacion_uf_m2",
      "Facturación UF/m²",
      "uf_m2",
      {
        mesReal: 0.5,
        mesPpto: 0.55,
        mesPrior: 0.45,
        ytdReal: 5.0,
        ytdPpto: 5.5,
        ytdPrior: 4.5
      },
      "Facturación"
    );

    expect(kpi.key).toBe("facturacion_uf_m2");
    expect(kpi.section).toBe("Facturación");
    expect(kpi.mes.real).toBe(0.5);
    expect(kpi.mes.ppto).toBe(0.55);
    expect(kpi.mes.yoy).toBeCloseTo(((0.5 - 0.45) / 0.45) * 100, 5);
    expect(kpi.ytd.real).toBe(5.0);
    expect(kpi.ytd.yoy).toBeCloseTo(((5.0 - 4.5) / 4.5) * 100, 5);
  });

  it("maneja entradas null sin romper", () => {
    const kpi = buildPanelKpi("vacancia_pct", "Vacancia %", "pct", {
      mesReal: 10,
      mesPpto: null,
      mesPrior: null,
      ytdReal: null,
      ytdPpto: null,
      ytdPrior: null
    });

    expect(kpi.mes.real).toBe(10);
    expect(kpi.mes.ppto).toBeNull();
    expect(kpi.mes.yoy).toBeNull();
    expect(kpi.ytd.real).toBeNull();
    expect(kpi.section).toBeNull();
  });
});
