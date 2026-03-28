import { EstadoContrato, TipoTarifaContrato } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildContractExpiryBuckets,
  buildFixedRentClpMetric,
  calculateContractStateCounters,
  calculateEstimatedGgccUf,
  calculateFixedRentUf,
  calculateGlaMetrics,
  calculateOccupancy,
  calculateVacancy,
  type KpiContractInput,
  type KpiLocalInput
} from "@/lib/kpi";

const activeLocales: KpiLocalInput[] = [
  { id: "l1", codigo: "L-101", esGLA: true, glam2: "100" },
  { id: "l2", codigo: "L-102", esGLA: true, glam2: "80" },
  { id: "l3", codigo: "L-103", esGLA: true, glam2: "60" }
];

function makeContract(overrides: Partial<KpiContractInput>): KpiContractInput {
  return {
    id: "c1",
    localId: "l1",
    localCodigo: "L-101",
    localEsGLA: true,
    localGlam2: "100",
    arrendatarioNombre: "Acme",
    numeroContrato: "CTR-1",
    fechaTermino: new Date("2026-04-10T00:00:00.000Z"),
    tarifa: null,
    ggcc: null,
    ...overrides
  };
}

describe("occupancy and vacancy KPIs", () => {
  it("returns 0% occupancy when all active locales are vacant", () => {
    const occupancy = calculateOccupancy(activeLocales, []);
    const vacancy = calculateVacancy(activeLocales, []);

    expect(occupancy.porcentaje).toBe(0);
    expect(occupancy.ocupados).toBe(0);
    expect(occupancy.totalActivos).toBe(3);
    expect(vacancy.totalVacantes).toBe(3);
    expect(vacancy.codigosPrimerosTres).toEqual(["L-101", "L-102", "L-103"]);
  });

  it("calculates occupied and leased GLA correctly", () => {
    const contracts = [
      makeContract({ id: "c1", localId: "l1", localCodigo: "L-101", localGlam2: "100" }),
      makeContract({ id: "c2", localId: "l2", localCodigo: "L-102", localGlam2: "80" })
    ];

    const occupancy = calculateOccupancy(activeLocales, contracts);
    const gla = calculateGlaMetrics(activeLocales, contracts);

    expect(occupancy.porcentaje).toBeCloseTo(66.666, 2);
    expect(gla.glaArrendada).toBe(180);
    expect(gla.glaTotal).toBe(240);
  });
});

describe("rent KPIs", () => {
  it("computes fixed rent UF and GGCC UF", () => {
    const contracts = [
      makeContract({
        id: "c1",
        localId: "l1",
        localGlam2: "100",
        tarifa: { tipo: TipoTarifaContrato.FIJO_UF_M2, valor: "0.5" },
        ggcc: { tarifaBaseUfM2: "0.2", pctAdministracion: "10" }
      }),
      makeContract({
        id: "c2",
        localId: "l2",
        localGlam2: "80",
        tarifa: { tipo: TipoTarifaContrato.FIJO_UF, valor: "25" },
        ggcc: { tarifaBaseUfM2: "0.1", pctAdministracion: "0" }
      }),
      makeContract({
        id: "c3",
        localId: "l3",
        localGlam2: "60",
        tarifa: { tipo: TipoTarifaContrato.PORCENTAJE, valor: "8" },
        ggcc: null
      })
    ];

    expect(calculateFixedRentUf(contracts)).toBe(75);
    expect(calculateEstimatedGgccUf(contracts)).toBe(30);
  });

  it("returns graceful fallback when UF value is missing", () => {
    expect(buildFixedRentClpMetric(100, null)).toEqual({
      value: "Sin valor UF",
      subtitle: "No hay valor UF registrado"
    });
  });
});

describe("portfolio KPIs", () => {
  it("calculates contract percentages for mixed states", () => {
    const metrics = calculateContractStateCounters([
      { estado: EstadoContrato.VIGENTE, cantidad: 2 },
      { estado: EstadoContrato.GRACIA, cantidad: 1 },
      { estado: EstadoContrato.TERMINADO_ANTICIPADO, cantidad: 1 },
      { estado: EstadoContrato.TERMINADO, cantidad: 2 }
    ]);

    expect(metrics.total).toBe(6);
    expect(metrics.counters).toEqual([
      expect.objectContaining({ estado: "VIGENTE", cantidad: 2, porcentaje: 33.33333333333333 }),
      expect.objectContaining({ estado: "GRACIA", cantidad: 1, porcentaje: 16.666666666666664 }),
      expect.objectContaining({
        estado: "TERMINADO_ANTICIPADO",
        cantidad: 1,
        porcentaje: 16.666666666666664
      }),
      expect.objectContaining({ estado: "TERMINADO", cantidad: 2, porcentaje: 33.33333333333333 })
    ]);
  });

  it("returns empty expiry rows when there are no contracts expiring", () => {
    const buckets = buildContractExpiryBuckets([], new Date("2026-03-27T12:00:00.000Z"));
    expect(buckets[30]).toHaveLength(0);
    expect(buckets[60]).toHaveLength(0);
    expect(buckets[90]).toHaveLength(0);
  });

  it("builds expiry windows sorted by date, capped to 10 rows, and excluding overdue contracts", () => {
    const today = new Date("2026-03-27T12:00:00.000Z");
    const contracts: KpiContractInput[] = [
      makeContract({ id: "expired", fechaTermino: new Date("2026-03-26T12:00:00.000Z") }),
      ...Array.from({ length: 12 }).map((_, index) =>
        makeContract({
          id: `c-${index + 1}`,
          numeroContrato: `CTR-${index + 1}`,
          fechaTermino: new Date(`2026-04-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`)
        })
      )
    ];

    const buckets = buildContractExpiryBuckets(contracts, today);

    expect(buckets[30]).toHaveLength(10);
    expect(buckets[30].map((row) => row.id)).toEqual([
      "c-1",
      "c-2",
      "c-3",
      "c-4",
      "c-5",
      "c-6",
      "c-7",
      "c-8",
      "c-9",
      "c-10"
    ]);
    expect(buckets[30][0]?.diasRestantes).toBe(5);
    expect(buckets[90].some((row) => row.id === "expired")).toBe(false);
  });
});
