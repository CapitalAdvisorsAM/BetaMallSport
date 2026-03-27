import { describe, expect, it } from "vitest";
import {
  buildArrendatariosWhere,
  parseVigenteFilter,
  toContractMetrics
} from "@/lib/rent-roll/arrendatarios";

describe("parseVigenteFilter", () => {
  it("parses valid values", () => {
    expect(parseVigenteFilter("vigente")).toBe(true);
    expect(parseVigenteFilter("no-vigente")).toBe(false);
  });

  it("returns undefined for unknown values", () => {
    expect(parseVigenteFilter("all")).toBeUndefined();
    expect(parseVigenteFilter(undefined)).toBeUndefined();
  });
});

describe("buildArrendatariosWhere", () => {
  it("builds where with project only when no filters", () => {
    expect(buildArrendatariosWhere("p-1", { q: "" })).toEqual({
      proyectoId: "p-1"
    });
  });

  it("adds vigente and text search clauses", () => {
    expect(buildArrendatariosWhere("p-1", { q: "acme", vigente: true })).toEqual({
      proyectoId: "p-1",
      vigente: true,
      OR: [
        { nombreComercial: { contains: "acme", mode: "insensitive" } },
        { rut: { contains: "acme", mode: "insensitive" } }
      ]
    });
  });
});

describe("toContractMetrics", () => {
  it("returns placeholder values when there is no active contract", () => {
    expect(toContractMetrics(null)).toEqual({
      localActual: "\u2014",
      tarifaVigenteUfM2: "\u2014",
      ggccTarifaBaseUfM2: "\u2014",
      ggccPctAdministracion: "\u2014"
    });
  });

  it("maps active contract values", () => {
    expect(
      toContractMetrics({
        local: { codigo: "L-101", nombre: "Norte" },
        tarifas: [{ valor: { toString: () => "1.234" } }],
        ggcc: [{ tarifaBaseUfM2: { toString: () => "0.33" }, pctAdministracion: { toString: () => "9" } }]
      })
    ).toEqual({
      localActual: "L-101 - Norte",
      tarifaVigenteUfM2: "1,23",
      ggccTarifaBaseUfM2: "0,33",
      ggccPctAdministracion: "9,00"
    });
  });
});

