import { describe, expect, it } from "vitest";
import {
  buildTenantsActiveContractWhere,
  buildTenantsWhere,
  parseTenantActiveFilter
} from "@/lib/plan/tenants";

describe("parseTenantActiveFilter", () => {
  it("parses valid values", () => {
    expect(parseTenantActiveFilter("vigente")).toBe(true);
    expect(parseTenantActiveFilter("no-vigente")).toBe(false);
  });

  it("returns undefined for unknown values", () => {
    expect(parseTenantActiveFilter("all")).toBeUndefined();
    expect(parseTenantActiveFilter(undefined)).toBeUndefined();
  });
});

describe("buildTenantsActiveContractWhere", () => {
  it("builds where with active-day constraints", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const nextMonthStart = new Date("2026-04-01T00:00:00.000Z");

    expect(buildTenantsActiveContractWhere({ start, nextMonthStart })).toEqual({
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

describe("buildTenantsWhere", () => {
  it("builds where with project and active-contract constraints", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const nextMonthStart = new Date("2026-04-01T00:00:00.000Z");

    expect(buildTenantsWhere("p-1", { start, nextMonthStart }, { q: "" })).toEqual({
      projectId: "p-1",
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

  it("adds vigente and text search clauses at tenant level", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const nextMonthStart = new Date("2026-04-01T00:00:00.000Z");

    expect(
      buildTenantsWhere(
        "p-1",
        { start, nextMonthStart },
        { q: "acme", vigente: true }
      )
    ).toEqual({
      projectId: "p-1",
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
