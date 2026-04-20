import { describe, expect, it } from "vitest";
import {
  formatPanelValue,
  formatPanelYoy,
  realVsPptoSemaphore,
  semaphoreClass,
  yoySemaphore
} from "./panel-cdg-format";

describe("formatPanelValue", () => {
  it("returns em dash for null", () => {
    expect(formatPanelValue(null, "uf")).toBe("\u2014");
  });

  it("returns em dash for NaN", () => {
    expect(formatPanelValue(Number.NaN, "pct")).toBe("\u2014");
  });

  it("formats UF with two decimals in es-CL locale", () => {
    expect(formatPanelValue(1234.5, "uf")).toMatch(/1\.234,50/);
  });

  it("formats percent with one decimal", () => {
    expect(formatPanelValue(85.2, "pct")).toMatch(/85,2%/);
  });

  it("formats square meters", () => {
    expect(formatPanelValue(1000, "m2")).toMatch(/m\u00b2/);
  });

  it("formats UF/m2 composite unit", () => {
    expect(formatPanelValue(0.3, "uf_m2")).toMatch(/UF\/m\u00b2/);
  });
});

describe("formatPanelYoy", () => {
  it("returns em dash for null", () => {
    expect(formatPanelYoy(null)).toBe("\u2014");
  });

  it("adds + sign for positive values", () => {
    expect(formatPanelYoy(5.2)).toMatch(/^\+5,2%$/);
  });

  it("preserves negative sign for negative values", () => {
    expect(formatPanelYoy(-3.1)).toMatch(/^-3,1%$/);
  });

  it("does not add sign for zero", () => {
    expect(formatPanelYoy(0)).toMatch(/^0,0%$/);
  });
});

describe("realVsPptoSemaphore", () => {
  it("returns neutral when real or ppto is null", () => {
    expect(realVsPptoSemaphore(null, 100)).toBe("neutral");
    expect(realVsPptoSemaphore(100, null)).toBe("neutral");
  });

  it("returns neutral when ppto is zero", () => {
    expect(realVsPptoSemaphore(100, 0)).toBe("neutral");
  });

  it("returns green when real meets or exceeds ppto", () => {
    expect(realVsPptoSemaphore(100, 100)).toBe("green");
    expect(realVsPptoSemaphore(110, 100)).toBe("green");
  });

  it("returns amber when real is between 95% and 100% of ppto", () => {
    expect(realVsPptoSemaphore(97, 100)).toBe("amber");
  });

  it("returns red when real is below 95% of ppto", () => {
    expect(realVsPptoSemaphore(80, 100)).toBe("red");
  });
});

describe("yoySemaphore", () => {
  it("returns neutral for null", () => {
    expect(yoySemaphore(null)).toBe("neutral");
  });

  it("returns green for positive growth", () => {
    expect(yoySemaphore(5)).toBe("green");
  });

  it("returns red for negative growth", () => {
    expect(yoySemaphore(-3)).toBe("red");
  });

  it("returns neutral for zero", () => {
    expect(yoySemaphore(0)).toBe("neutral");
  });
});

describe("semaphoreClass", () => {
  it("maps each semaphore to a text color class", () => {
    expect(semaphoreClass("green")).toMatch(/emerald/);
    expect(semaphoreClass("amber")).toMatch(/amber/);
    expect(semaphoreClass("red")).toMatch(/rose/);
    expect(semaphoreClass("neutral")).toMatch(/slate/);
  });
});
