import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMERCIAL_SIZE_RULES,
  formatCalculatedLocalSize,
  getCalculatedLocalSize,
  parseSquareMeters
} from "@/lib/units/size";

describe("local size helpers", () => {
  it("parses square meters with comma or dot", () => {
    expect(parseSquareMeters("48,5")).toBe(48.5);
    expect(parseSquareMeters("48.5")).toBe(48.5);
    expect(parseSquareMeters("")).toBeNull();
  });

  it("classifies special local types directly", () => {
    expect(getCalculatedLocalSize("BODEGA", "999")).toBe("BODEGA");
    expect(getCalculatedLocalSize("MODULO", "12")).toBe("MODULO");
    expect(getCalculatedLocalSize("ESPACIO", "7")).toBe("ESPACIO");
  });

  it("classifies commercial locales by configured square meter rules", () => {
    expect(getCalculatedLocalSize("LOCAL_COMERCIAL", "40", DEFAULT_COMMERCIAL_SIZE_RULES)).toBe(
      "TIENDA_MENOR"
    );
    expect(getCalculatedLocalSize("LOCAL_COMERCIAL", "75", DEFAULT_COMMERCIAL_SIZE_RULES)).toBe(
      "TIENDA_MEDIANA"
    );
    expect(getCalculatedLocalSize("LOCAL_COMERCIAL", "150", DEFAULT_COMMERCIAL_SIZE_RULES)).toBe(
      "TIENDA_MAYOR"
    );
  });

  it("formats the final label for display", () => {
    expect(formatCalculatedLocalSize("TIENDA_MEDIANA")).toBe("Tienda mediana");
    expect(formatCalculatedLocalSize(null)).toBe("Sin clasificar");
  });
});
