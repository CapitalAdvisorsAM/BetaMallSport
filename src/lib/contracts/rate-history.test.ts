import { describe, expect, it } from "vitest";

import { activeAsOfWhere, coversValidAtWhere } from "./rate-history";

describe("activeAsOfWhere", () => {
  it("without asOf returns 'current truth' filter (supersededAt IS NULL)", () => {
    expect(activeAsOfWhere()).toEqual({ supersededAt: null });
    expect(activeAsOfWhere(undefined)).toEqual({ supersededAt: null });
  });

  it("with asOf reconstructs 'what was known at that moment'", () => {
    const asOf = new Date("2025-08-01T00:00:00Z");
    const where = activeAsOfWhere(asOf);

    // Row must have been created on or before asOf,
    // AND not yet superseded at asOf (or never superseded).
    expect(where).toEqual({
      AND: [
        { createdAt: { lte: asOf } },
        {
          OR: [{ supersededAt: null }, { supersededAt: { gt: asOf } }]
        }
      ]
    });
  });

  it("treats supersededAt boundary strictly: gt asOf (not gte)", () => {
    // Rationale: if a row was superseded at exactly asOf, the new version takes over
    // from that instant. The old row is no longer the truth at asOf.
    const asOf = new Date("2025-08-01T12:34:56Z");
    const where = activeAsOfWhere(asOf);
    const inner = (where as { AND: Array<Record<string, unknown>> }).AND[1] as {
      OR: Array<{ supersededAt: unknown }>;
    };
    expect(inner.OR[1]).toEqual({ supersededAt: { gt: asOf } });
  });
});

describe("coversValidAtWhere", () => {
  it("covers when vigenciaDesde <= validAt and vigenciaHasta >= validAt (or null)", () => {
    const validAt = new Date("2026-06-15");
    const where = coversValidAtWhere(validAt);

    expect(where).toEqual({
      AND: [
        { vigenciaDesde: { lte: validAt } },
        {
          OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: validAt } }]
        }
      ]
    });
  });

  it("treats vigenciaHasta as inclusive (gte, not gt)", () => {
    // Rationale: vigenciaHasta is a date-only field representing the last day the rate
    // applies. A rate with vigenciaHasta = 2026-06-15 IS valid on 2026-06-15.
    const validAt = new Date("2026-06-15");
    const where = coversValidAtWhere(validAt);
    const inner = (where as { AND: Array<Record<string, unknown>> }).AND[1] as {
      OR: Array<{ vigenciaHasta: unknown }>;
    };
    expect(inner.OR[1]).toEqual({ vigenciaHasta: { gte: validAt } });
  });
});
