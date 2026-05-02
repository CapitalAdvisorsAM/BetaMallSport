import { describe, expect, it } from "vitest";
import { ContractStatus, ContractRateType } from "@prisma/client";
import {
  buildBudgetVsActual,
  type BvaContract,
  type BvaBudgetedSale,
  type BvaAccountingRecord
} from "./budget-vs-actual";

function makeContract(overrides: Partial<BvaContract> = {}): BvaContract {
  return {
    id: "c1",
    localId: "u1",
    arrendatarioId: "t1",
    estado: ContractStatus.VIGENTE,
    fechaInicio: new Date("2026-01-01"),
    fechaTermino: new Date("2028-12-31"),
    multiplicadorDiciembre: null,
    multiplicadorJunio: null,
    multiplicadorJulio: null,
    multiplicadorAgosto: null,
    pctFondoPromocion: null,
    local: { id: "u1", codigo: "U1", nombre: "Local 1", glam2: "100" },
    arrendatario: { id: "t1", rut: "1-1", nombreComercial: "Tenant 1" },
    tarifas: [
      {
        tipo: ContractRateType.FIJO_UF_M2,
        valor: "1",
        vigenciaDesde: new Date("2026-01-01"),
        vigenciaHasta: new Date("2028-12-31"),
        esDiciembre: false
      }
    ],
    ggcc: [],
    ...overrides
  };
}

describe("buildBudgetVsActual — estado GRACIA", () => {
  it("excludes contract in GRACIA from budget (budget = 0)", () => {
    const contracts = [makeContract({ estado: ContractStatus.GRACIA })];
    const result = buildBudgetVsActual(contracts, [], [], ["2026-06"]);
    expect(result.rows[0].budgetUf).toBe(0);
    expect(result.rows[0].byPeriod["2026-06"].budgetUf).toBe(0);
    expect(result.summary.totalBudgetUf).toBe(0);
  });

  it("includes contract in VIGENTE", () => {
    const contracts = [makeContract({ estado: ContractStatus.VIGENTE })];
    const result = buildBudgetVsActual(contracts, [], [], ["2026-06"]);
    // 1 * 100 = 100
    expect(result.rows[0].budgetUf).toBe(100);
    expect(result.rows[0].byPeriod["2026-06"].budgetUf).toBe(100);
  });
});

describe("buildBudgetVsActual — variable rent lag", () => {
  it("uses sales from M-1 to compute variable rent in month M", () => {
    const contracts = [
      makeContract({
        tarifas: [
          {
            tipo: ContractRateType.FIJO_UF_M2,
            valor: "1",
            vigenciaDesde: new Date("2026-01-01"),
            vigenciaHasta: new Date("2028-12-31"),
            esDiciembre: false
          },
          {
            tipo: ContractRateType.PORCENTAJE,
            valor: "10",
            vigenciaDesde: new Date("2026-01-01"),
            vigenciaHasta: new Date("2028-12-31"),
            esDiciembre: false
          }
        ]
      })
    ];
    const sales: BvaBudgetedSale[] = [
      { tenantId: "t1", period: new Date("2026-05-01"), salesPesos: "5000" }
    ];
    const result = buildBudgetVsActual(contracts, [], sales, ["2026-06"], new Map([["2026-05", 1]]));
    // fixed = 1 * 100 = 100; variable = max(0, 5000/1 * 10/100 - 100) = 400
    // total = 500
    expect(result.rows[0].budgetUf).toBe(500);
    expect(result.rows[0].byPeriod["2026-06"].budgetUf).toBe(500);
  });

  it("flags missingSalesPeriods when PORCENTAJE rate but no budgeted sale for lag month", () => {
    const contracts = [
      makeContract({
        tarifas: [
          {
            tipo: ContractRateType.FIJO_UF_M2,
            valor: "1",
            vigenciaDesde: new Date("2026-01-01"),
            vigenciaHasta: new Date("2028-12-31"),
            esDiciembre: false
          },
          {
            tipo: ContractRateType.PORCENTAJE,
            valor: "10",
            vigenciaDesde: new Date("2026-01-01"),
            vigenciaHasta: new Date("2028-12-31"),
            esDiciembre: false
          }
        ]
      })
    ];
    const result = buildBudgetVsActual(contracts, [], [], ["2026-06"]);
    expect(result.rows[0].missingSalesPeriods).toContain("2026-06");
    expect(result.rows[0].byPeriod["2026-06"].missingSales).toBe(true);
  });

  it("does not flag missing sales when there are no PORCENTAJE rates", () => {
    const contracts = [makeContract()];
    const result = buildBudgetVsActual(contracts, [], [], ["2026-06"]);
    expect(result.rows[0].missingSalesPeriods).toEqual([]);
  });
});

describe("buildBudgetVsActual — multi-unit aggregation per tenant", () => {
  it("sums GLA and budget across multiple units for same tenant", () => {
    const contracts: BvaContract[] = [
      makeContract({ id: "c1", localId: "u1", local: { id: "u1", codigo: "U1", nombre: "L1", glam2: "50" } }),
      makeContract({ id: "c2", localId: "u2", local: { id: "u2", codigo: "U2", nombre: "L2", glam2: "70" } })
    ];
    const result = buildBudgetVsActual(contracts, [], [], ["2026-06"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].glam2).toBe(120);
    // 1 * (50 + 70) = 120
    expect(result.rows[0].budgetUf).toBe(120);
    expect(result.rows[0].locales).toHaveLength(2);
  });
});

describe("buildBudgetVsActual — actual billing", () => {
  it("matches actual billing by unitId and REVENUE_GROUP only", () => {
    const contracts = [makeContract()];
    const records: BvaAccountingRecord[] = [
      { unitId: "u1", period: new Date("2026-06-01"), group1: "INGRESOS DE EXPLOTACION", valueUf: "120" },
      { unitId: "u1", period: new Date("2026-06-01"), group1: "OTRO", valueUf: "999" },
      { unitId: "other", period: new Date("2026-06-01"), group1: "INGRESOS DE EXPLOTACION", valueUf: "500" }
    ];
    const result = buildBudgetVsActual(contracts, records, [], ["2026-06"]);
    expect(result.rows[0].actualUf).toBe(120);
    expect(result.rows[0].byPeriod["2026-06"].actualUf).toBe(120);
  });
});
