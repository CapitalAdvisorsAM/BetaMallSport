import { describe, expect, it } from "vitest";
import {
  buildArrendatariosActiveContractWhere,
  buildArrendatariosWhere,
  parseVigenteFilter
} from "@/lib/rent-roll/tenants";

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

describe("buildArrendatariosActiveContractWhere", () => {
  it("builds where with active-day constraints", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const nextMonthStart = new Date("2026-04-01T00:00:00.000Z");

    expect(buildArrendatariosActiveContractWhere({ start, nextMonthStart })).toEqual({
      OR: [
        {
          contratosDia: {
            some: {
              fecha: { gte: start, lt: nextMonthStart },
              estadoDia: { in: ["OCUPADO", "GRACIA"] }
            }
          }
        },
        {
          fechaInicio: { lt: nextMonthStart },
          fechaTermino: { gte: start },
          estado: { in: ["VIGENTE", "GRACIA"] }
        }
      ]
    });
  });
});

describe("buildArrendatariosWhere", () => {
  it("builds where with project and active-contract constraints", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const nextMonthStart = new Date("2026-04-01T00:00:00.000Z");

    expect(buildArrendatariosWhere("p-1", { start, nextMonthStart }, { q: "" })).toEqual({
      proyectoId: "p-1",
      contratos: {
        some: {
          OR: [
            {
              contratosDia: {
                some: {
                  fecha: { gte: start, lt: nextMonthStart },
                  estadoDia: { in: ["OCUPADO", "GRACIA"] }
                }
              }
            },
            {
              fechaInicio: { lt: nextMonthStart },
              fechaTermino: { gte: start },
              estado: { in: ["VIGENTE", "GRACIA"] }
            }
          ]
        }
      }
    });
  });

  it("adds vigente and text search clauses at arrendatario level", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const nextMonthStart = new Date("2026-04-01T00:00:00.000Z");

    expect(
      buildArrendatariosWhere(
        "p-1",
        { start, nextMonthStart },
        { q: "acme", vigente: true }
      )
    ).toEqual({
      proyectoId: "p-1",
      contratos: {
        some: {
          OR: [
            {
              contratosDia: {
                some: {
                  fecha: { gte: start, lt: nextMonthStart },
                  estadoDia: { in: ["OCUPADO", "GRACIA"] }
                }
              }
            },
            {
              fechaInicio: { lt: nextMonthStart },
              fechaTermino: { gte: start },
              estado: { in: ["VIGENTE", "GRACIA"] }
            }
          ]
        }
      },
      vigente: true,
      OR: [
        { nombreComercial: { contains: "acme", mode: "insensitive" } },
        { rut: { contains: "acme", mode: "insensitive" } }
      ]
    });
  });
});

