import { describe, expect, it } from "vitest";
import { ContractDiscountType, ContractRateType, ContractStatus, UnitType } from "@prisma/client";
import {
  buildContractComparison,
  type ComparisonAccountingRecord,
  type ComparisonContractInput,
  type ComparisonSaleRecord,
} from "./contract-comparison";

function contract(overrides: Partial<ComparisonContractInput> = {}): ComparisonContractInput {
  const id = overrides.id ?? "target";
  return {
    id,
    numeroContrato: `C-${id}`,
    localId: `unit-${id}`,
    arrendatarioId: `tenant-${id}`,
    arrendatario: { nombreComercial: `Tenant ${id}`, razonSocial: `Tenant ${id}` },
    local: {
      id: `unit-${id}`,
      codigo: `L-${id}`,
      nombre: `Local ${id}`,
      glam2: "100",
      piso: "1",
      tipo: UnitType.LOCAL_COMERCIAL,
      zonaId: "zone-a",
      categoriaTamano: "MEDIANO",
    },
    estado: ContractStatus.VIGENTE,
    fechaInicio: new Date("2024-01-01T00:00:00.000Z"),
    fechaTermino: new Date("2024-12-31T00:00:00.000Z"),
    pctFondoPromocion: null,
    multiplicadorDiciembre: null,
    multiplicadorJunio: null,
    multiplicadorJulio: null,
    multiplicadorAgosto: null,
    tarifas: [
      {
        tipo: ContractRateType.FIJO_UF_M2,
        valor: "1",
        umbralVentasUf: null,
        pisoMinimoUf: null,
        vigenciaDesde: new Date("2024-01-01T00:00:00.000Z"),
        vigenciaHasta: null,
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null,
      },
    ],
    ggcc: [],
    ...overrides,
  };
}

function build(overrides: {
  target?: ComparisonContractInput;
  candidates?: ComparisonContractInput[];
  accountingRecords?: ComparisonAccountingRecord[];
  salesRecords?: ComparisonSaleRecord[];
} = {}) {
  return buildContractComparison({
    target: overrides.target ?? contract(),
    candidates: overrides.candidates ?? [],
    accountingRecords: overrides.accountingRecords ?? [],
    salesRecords: overrides.salesRecords ?? [],
    ufRateByPeriod: new Map([
      ["2023-12", 1000],
      ["2024-01", 1000],
      ["2024-02", 1000],
      ["2024-03", 1000],
    ]),
    desdeDate: new Date("2024-01-01T00:00:00.000Z"),
    hastaDate: new Date("2024-03-01T00:00:00.000Z"),
    today: new Date("2024-03-15T00:00:00.000Z"),
  });
}

describe("buildContractComparison", () => {
  it("calculates fixed rent per m2 for UF/m2 and fixed UF tariffs", () => {
    const result = build({
      candidates: [
        contract({
          id: "peer-1",
          tarifas: [
            {
              tipo: ContractRateType.FIJO_UF,
              valor: "200",
              umbralVentasUf: null,
              pisoMinimoUf: null,
              vigenciaDesde: new Date("2024-01-01T00:00:00.000Z"),
              vigenciaHasta: null,
              esDiciembre: false,
              descuentoTipo: null,
              descuentoValor: null,
              descuentoDesde: null,
              descuentoHasta: null,
            },
          ],
        }),
        contract({ id: "peer-2", tarifas: [{ ...contract().tarifas[0], valor: "3" }] }),
      ],
    });

    expect(result.current.fixedRentUf).toBe(100);
    expect(result.current.fixedRentUfM2).toBe(1);
    expect(result.metrics.fixedRentUfM2.peerAverage).toBe(2.5);
    expect(result.metrics.fixedRentUfM2.rankPosition).toBe(3);
  });

  it("includes GGCC administration in UF/m2", () => {
    const result = build({
      target: contract({
        ggcc: [
          {
            tarifaBaseUfM2: "0.5",
            pctAdministracion: "10",
            vigenciaDesde: new Date("2024-01-01T00:00:00.000Z"),
            vigenciaHasta: null,
          },
        ],
      }),
    });

    expect(result.current.ggccUf).toBeCloseTo(55);
    expect(result.current.ggccUfM2).toBeCloseTo(0.55);
  });

  it("preserves variable rent floor and active discounts", () => {
    const result = build({
      target: contract({
        tarifas: [
          { ...contract().tarifas[0], descuentoTipo: ContractDiscountType.PORCENTAJE, descuentoValor: "0.1" },
          {
            tipo: ContractRateType.PORCENTAJE,
            valor: "8",
            umbralVentasUf: "1000",
            pisoMinimoUf: "150",
            vigenciaDesde: new Date("2024-01-01T00:00:00.000Z"),
            vigenciaHasta: null,
            esDiciembre: false,
            descuentoTipo: null,
            descuentoValor: null,
            descuentoDesde: null,
            descuentoHasta: null,
          },
        ],
      }),
    });

    expect(result.current.variablePct).toBe(8);
    expect(result.current.pisoMinimoUf).toBe(150);
    expect(result.current.discountLabel).toBe("10%");
  });

  it("calculates performance metrics and deltas against peers", () => {
    const target = contract();
    const peer = contract({ id: "peer-1" });
    const accountingRecords: ComparisonAccountingRecord[] = [
      { unitId: target.localId, tenantId: target.arrendatarioId, period: new Date("2024-01-01"), group1: "INGRESOS DE EXPLOTACION", valueUf: "300" },
      { unitId: peer.localId, tenantId: peer.arrendatarioId, period: new Date("2024-01-01"), group1: "INGRESOS DE EXPLOTACION", valueUf: "150" },
    ];
    const salesRecords: ComparisonSaleRecord[] = [
      { tenantId: target.arrendatarioId, period: new Date("2024-01-01"), salesPesos: "300000" },
      { tenantId: peer.arrendatarioId, period: new Date("2024-01-01"), salesPesos: "150000" },
    ];

    const result = build({
      candidates: [peer, contract({ id: "peer-2" })],
      accountingRecords,
      salesRecords,
    });

    expect(result.current.avgBillingUfM2).toBe(1);
    expect(result.current.avgSalesUfM2).toBe(1);
    expect(result.current.occupancyCostPct).toBe(100);
    expect(result.metrics.avgBillingUfM2.deltaVsAverage).toBeGreaterThan(0);
  });

  it("falls back from strict peers to same category and zone when strict peers are scarce", () => {
    const result = build({
      candidates: [
        contract({ id: "strict-peer" }),
        contract({ id: "zone-peer", local: { ...contract().local, id: "unit-zone-peer", codigo: "Z", piso: "2" } }),
        contract({ id: "other-zone-peer", local: { ...contract().local, id: "unit-other", codigo: "O", piso: "3", zonaId: "zone-b" } }),
      ],
    });

    expect(result.matchLevel).toBe("zone");
    expect(result.peerCount).toBe(2);
  });

  it("returns an empty comparison state when there are no similar contracts", () => {
    const result = build({
      candidates: [
        contract({
          id: "different",
          local: { ...contract().local, id: "unit-different", tipo: UnitType.BODEGA },
        }),
      ],
    });

    expect(result.matchLevel).toBe("none");
    expect(result.peerCount).toBe(0);
    expect(result.metrics.fixedRentUfM2.peerAverage).toBeNull();
  });
});
