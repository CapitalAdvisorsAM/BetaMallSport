import { describe, expect, it } from "vitest";
import {
  buildBudgetedSalesMatrix,
  buildPeriodRange,
  periodToDate,
  type BudgetedSaleMatrixInput,
  type TenantInfo,
} from "./budgeted-sales-matrix";

function tenant(id: string, nombreComercial: string, rut = `rut-${id}`): TenantInfo {
  return { id, nombreComercial, rut };
}

function sale(tenantId: string, period: string, salesUf: number): BudgetedSaleMatrixInput {
  return { tenantId, period: periodToDate(period), salesUf };
}

describe("buildPeriodRange", () => {
  it("returns inclusive range of YYYY-MM between desde and hasta", () => {
    expect(buildPeriodRange("2026-01", "2026-03")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("returns single period when desde equals hasta", () => {
    expect(buildPeriodRange("2026-05", "2026-05")).toEqual(["2026-05"]);
  });

  it("returns empty array when desde is after hasta", () => {
    expect(buildPeriodRange("2026-06", "2026-01")).toEqual([]);
  });

  it("handles year rollover", () => {
    expect(buildPeriodRange("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("buildBudgetedSalesMatrix", () => {
  const periods = ["2026-01", "2026-02", "2026-03"];

  it("returns full matrix with totals when all periods have data", () => {
    const tenantsById = new Map([["t1", tenant("t1", "Alpha")]]);
    const glaByTenantId = new Map([["t1", 100]]);
    const budgetedSales = [
      sale("t1", "2026-01", 50),
      sale("t1", "2026-02", 60),
      sale("t1", "2026-03", 70),
    ];

    const result = buildBudgetedSalesMatrix({
      budgetedSales,
      tenantsById,
      glaByTenantId,
      periods,
    });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.byPeriod).toEqual({ "2026-01": 50, "2026-02": 60, "2026-03": 70 });
    expect(row.total).toBe(180);
    expect(row.glam2).toBe(100);
    expect(row.missingPeriods).toEqual([]);
    expect(result.summary.totalBudgetUf).toBe(180);
    expect(result.summary.tenantsWithData).toBe(1);
    expect(result.summary.tenantsWithMissing).toBe(0);
  });

  it("marks missing periods as null and increments tenantsWithMissing", () => {
    const tenantsById = new Map([["t1", tenant("t1", "Alpha")]]);
    const glaByTenantId = new Map([["t1", 80]]);
    const budgetedSales = [sale("t1", "2026-01", 10), sale("t1", "2026-03", 30)];

    const result = buildBudgetedSalesMatrix({
      budgetedSales,
      tenantsById,
      glaByTenantId,
      periods,
    });

    const row = result.rows[0];
    expect(row.byPeriod).toEqual({ "2026-01": 10, "2026-02": null, "2026-03": 30 });
    expect(row.total).toBe(40);
    expect(row.missingPeriods).toEqual(["2026-02"]);
    expect(result.summary.tenantsWithMissing).toBe(1);
  });

  it("distinguishes missing from zero", () => {
    const tenantsById = new Map([["t1", tenant("t1", "Alpha")]]);
    const glaByTenantId = new Map([["t1", 50]]);
    const budgetedSales = [
      sale("t1", "2026-01", 0),
      sale("t1", "2026-02", 0),
      sale("t1", "2026-03", 0),
    ];

    const result = buildBudgetedSalesMatrix({
      budgetedSales,
      tenantsById,
      glaByTenantId,
      periods,
    });

    const row = result.rows[0];
    expect(row.byPeriod["2026-01"]).toBe(0);
    expect(row.missingPeriods).toEqual([]);
    expect(result.summary.tenantsWithMissing).toBe(0);
  });

  it("excludes tenants without any data in the range", () => {
    const tenantsById = new Map([
      ["t1", tenant("t1", "Alpha")],
      ["t2", tenant("t2", "Beta")],
    ]);
    const glaByTenantId = new Map([
      ["t1", 100],
      ["t2", 200],
    ]);
    const budgetedSales = [sale("t1", "2026-02", 25)];

    const result = buildBudgetedSalesMatrix({
      budgetedSales,
      tenantsById,
      glaByTenantId,
      periods,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tenantId).toBe("t1");
    expect(result.summary.tenantsWithData).toBe(1);
  });

  it("sorts rows alphabetically by nombreComercial (Spanish locale)", () => {
    const tenantsById = new Map([
      ["t1", tenant("t1", "Zeta")],
      ["t2", tenant("t2", "álfa")],
      ["t3", tenant("t3", "Beta")],
    ]);
    const glaByTenantId = new Map([
      ["t1", 100],
      ["t2", 100],
      ["t3", 100],
    ]);
    const budgetedSales = [
      sale("t1", "2026-01", 10),
      sale("t2", "2026-01", 10),
      sale("t3", "2026-01", 10),
    ];

    const result = buildBudgetedSalesMatrix({
      budgetedSales,
      tenantsById,
      glaByTenantId,
      periods: ["2026-01"],
    });

    expect(result.rows.map((r) => r.nombreComercial)).toEqual(["álfa", "Beta", "Zeta"]);
  });

  it("ignores periods outside the provided range", () => {
    const tenantsById = new Map([["t1", tenant("t1", "Alpha")]]);
    const glaByTenantId = new Map([["t1", 100]]);
    const budgetedSales = [
      sale("t1", "2025-12", 999),
      sale("t1", "2026-01", 50),
      sale("t1", "2026-04", 777),
    ];

    const result = buildBudgetedSalesMatrix({
      budgetedSales,
      tenantsById,
      glaByTenantId,
      periods,
    });

    expect(result.rows[0].total).toBe(50);
    expect(result.rows[0].byPeriod).toEqual({ "2026-01": 50, "2026-02": null, "2026-03": null });
  });

  it("defaults glam2 to 0 when tenant has no active contracts", () => {
    const tenantsById = new Map([["t1", tenant("t1", "Alpha")]]);
    const glaByTenantId = new Map<string, number>();
    const budgetedSales = [sale("t1", "2026-01", 20)];

    const result = buildBudgetedSalesMatrix({
      budgetedSales,
      tenantsById,
      glaByTenantId,
      periods: ["2026-01"],
    });

    expect(result.rows[0].glam2).toBe(0);
  });

  it("aggregates duplicate tenant+period entries", () => {
    const tenantsById = new Map([["t1", tenant("t1", "Alpha")]]);
    const glaByTenantId = new Map([["t1", 100]]);
    const budgetedSales = [sale("t1", "2026-01", 10), sale("t1", "2026-01", 15)];

    const result = buildBudgetedSalesMatrix({
      budgetedSales,
      tenantsById,
      glaByTenantId,
      periods: ["2026-01"],
    });

    expect(result.rows[0].byPeriod["2026-01"]).toBe(25);
  });
});
