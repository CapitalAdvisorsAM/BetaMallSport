import { describe, expect, it } from "vitest";
import { buildUnitsWhere, parseUnitsStatus } from "@/lib/plan/units";

describe("parseUnitsStatus", () => {
  it("returns undefined for unsupported values", () => {
    expect(parseUnitsStatus("VIGENTE")).toBeUndefined();
    expect(parseUnitsStatus("")).toBeUndefined();
  });

  it("returns valid estado values", () => {
    expect(parseUnitsStatus("ACTIVO")).toBe("ACTIVO");
    expect(parseUnitsStatus("INACTIVO")).toBe("INACTIVO");
  });
});

describe("buildUnitsWhere", () => {
  it("builds where with project only when filters are empty", () => {
    expect(buildUnitsWhere("proyecto-1", { q: "" })).toEqual({
      projectId: "proyecto-1"
    });
  });

  it("adds estado and searchable OR clauses", () => {
    expect(buildUnitsWhere("proyecto-1", { q: "l-101", estado: "ACTIVO" })).toEqual({
      projectId: "proyecto-1",
      estado: "ACTIVO",
      OR: [
        { codigo: { contains: "l-101", mode: "insensitive" } },
        { nombre: { contains: "l-101", mode: "insensitive" } }
      ]
    });
  });
});
