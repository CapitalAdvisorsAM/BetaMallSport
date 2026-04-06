import { describe, expect, it } from "vitest";
import { buildLocalesWhere, parseLocalesEstado } from "@/lib/rent-roll/units";

describe("parseLocalesEstado", () => {
  it("returns undefined for unsupported values", () => {
    expect(parseLocalesEstado("VIGENTE")).toBeUndefined();
    expect(parseLocalesEstado("")).toBeUndefined();
  });

  it("returns valid estado values", () => {
    expect(parseLocalesEstado("ACTIVO")).toBe("ACTIVO");
    expect(parseLocalesEstado("INACTIVO")).toBe("INACTIVO");
  });
});

describe("buildLocalesWhere", () => {
  it("builds where with project only when filters are empty", () => {
    expect(buildLocalesWhere("proyecto-1", { q: "" })).toEqual({
      proyectoId: "proyecto-1"
    });
  });

  it("adds estado and searchable OR clauses", () => {
    expect(buildLocalesWhere("proyecto-1", { q: "l-101", estado: "ACTIVO" })).toEqual({
      proyectoId: "proyecto-1",
      estado: "ACTIVO",
      OR: [
        { codigo: { contains: "l-101", mode: "insensitive" } },
        { nombre: { contains: "l-101", mode: "insensitive" } }
      ]
    });
  });
});
