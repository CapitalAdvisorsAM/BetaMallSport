import { AccountingScenario, ContractStatus, UnitType, ContractRateType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildAlertCounts,
  buildIngresoDesglosadoFromAccounting,
  buildIngresoDesglosadoFromContracts,
  buildOcupacionDetalle,
  buildContractExpiryBuckets,
  buildVencimientosPorAnio,
  buildFixedRentClpMetric,
  calculateWalt,
  calculateContractStateCounters,
  calculateEstimatedGgccUf,
  calculateFixedRentUf,
  calculateGlaMetrics,
  calculateOccupancy,
  calculateVacancy,
  type KpiContractInput,
  type KpiLocalInput
} from "@/lib/kpi";
import { buildPivotKey, type AccountingPivotResult } from "@/lib/real/accounting-pivot";

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
    fechaInicio: new Date("2025-04-10T00:00:00.000Z"),
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
        tarifa: { tipo: ContractRateType.FIJO_UF_M2, valor: "0.5" },
        ggcc: { tarifaBaseUfM2: "0.2", pctAdministracion: "10" }
      }),
      makeContract({
        id: "c2",
        localId: "l2",
        localGlam2: "80",
        tarifa: { tipo: ContractRateType.FIJO_UF, valor: "25" },
        ggcc: { tarifaBaseUfM2: "0.1", pctAdministracion: "0" }
      }),
      makeContract({
        id: "c3",
        localId: "l3",
        localGlam2: "60",
        tarifa: { tipo: ContractRateType.PORCENTAJE, valor: "8" },
        ggcc: null
      })
    ];

    expect(calculateFixedRentUf(contracts)).toBe(75);
    expect(calculateEstimatedGgccUf(contracts)).toBe(30);
  });

  it("returns graceful fallback when UF value is missing", () => {
    expect(buildFixedRentClpMetric(100, null)).toEqual({
      value: "Sin valor UF",
      subtitle: "No hay valor UF registrado",
      stale: true
    });
  });

  it("marks UF as not stale when the valor UF is fresh", () => {
    const today = new Date("2026-04-20T00:00:00.000Z");
    const result = buildFixedRentClpMetric(
      100,
      { fecha: new Date("2026-04-19T00:00:00.000Z"), valor: "37000" },
      today
    );

    expect(result.stale).toBe(false);
    expect(result.subtitle.startsWith("UF al")).toBe(true);
  });

  it("marks UF as stale and annotates age when older than UF_STALENESS_DAYS", () => {
    const today = new Date("2026-04-20T00:00:00.000Z");
    const result = buildFixedRentClpMetric(
      100,
      { fecha: new Date("2026-04-10T00:00:00.000Z"), valor: "37000" },
      today
    );

    expect(result.stale).toBe(true);
    expect(result.subtitle.startsWith("UF desactualizada (10d)")).toBe(true);
  });

  it("calculates WALT weighted by GLA using total lease duration", () => {
    const contracts = [
      makeContract({
        id: "walt-1",
        localGlam2: "100",
        fechaInicio: new Date("2025-04-01T00:00:00.000Z"),
        fechaTermino: new Date("2027-04-01T00:00:00.000Z") // 24 months
      }),
      makeContract({
        id: "walt-2",
        localGlam2: "50",
        fechaInicio: new Date("2025-10-01T00:00:00.000Z"),
        fechaTermino: new Date("2026-10-01T00:00:00.000Z") // 12 months
      })
    ];
    // (24 × 100 + 12 × 50) / 150 = 3000 / 150 = 20
    expect(calculateWalt(contracts)).toBe(20);
  });

  it("returns zero WALT when all contracts have zero duration", () => {
    const contracts = [
      makeContract({
        id: "zero-dur-1",
        localGlam2: "120",
        fechaInicio: new Date("2026-03-31T00:00:00.000Z"),
        fechaTermino: new Date("2026-03-31T00:00:00.000Z")
      }),
      makeContract({
        id: "zero-dur-2",
        localGlam2: "80",
        fechaInicio: new Date("2025-12-31T00:00:00.000Z"),
        fechaTermino: new Date("2025-12-31T00:00:00.000Z")
      })
    ];

    expect(calculateWalt(contracts)).toBe(0);
  });

  it("returns zero WALT when no active contracts with positive GLA are provided", () => {
    expect(calculateWalt([])).toBe(0);
    expect(
      calculateWalt(
        [
          makeContract({
            id: "zero-gla",
            localGlam2: "0",
            fechaInicio: new Date("2025-09-01T00:00:00.000Z"),
            fechaTermino: new Date("2026-09-01T00:00:00.000Z")
          })
        ]
      )
    ).toBe(0);
  });
});

describe("portfolio KPIs", () => {
  it("calculates contract percentages for mixed states", () => {
    const metrics = calculateContractStateCounters([
      { estado: ContractStatus.VIGENTE, cantidad: 2 },
      { estado: ContractStatus.GRACIA, cantidad: 1 },
      { estado: ContractStatus.TERMINADO_ANTICIPADO, cantidad: 1 },
      { estado: ContractStatus.TERMINADO, cantidad: 2 }
    ]);

    expect(metrics.total).toBe(6);
    expect(metrics.counters).toEqual([
      expect.objectContaining({ estado: "VIGENTE", cantidad: 2, porcentaje: 33.33333333333333 }),
      expect.objectContaining({ estado: "NO_INICIADO", cantidad: 0, porcentaje: 0 }),
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

describe("cdg mall sport KPIs", () => {
  it("builds a full income breakdown with variable rent and energy", () => {
    const contratos = [
      makeContract({
        id: "fijo-comercial",
        localId: "loc-com",
        localGlam2: "100",
        tarifa: { tipo: ContractRateType.FIJO_UF_M2, valor: "0.5" }
      }),
      makeContract({
        id: "variable",
        localId: "loc-var",
        localGlam2: "80",
        arrendatarioId: "tenant-var",
        tarifa: null,
        tarifaVariablePct: "8"
      }),
      makeContract({
        id: "simulador",
        localId: "loc-sim",
        localGlam2: "20",
        tarifa: { tipo: ContractRateType.FIJO_UF, valor: "30" }
      }),
      makeContract({
        id: "espacio",
        localId: "loc-esp",
        localGlam2: "10",
        tarifa: { tipo: ContractRateType.FIJO_UF, valor: "12" }
      }),
      makeContract({
        id: "bodega",
        localId: "loc-bod",
        localGlam2: "15",
        tarifa: { tipo: ContractRateType.FIJO_UF, valor: "10" }
      })
    ];

    const locales = [
      { id: "loc-com", tipo: UnitType.LOCAL_COMERCIAL, esGLA: true, glam2: "100" },
      { id: "loc-var", tipo: UnitType.LOCAL_COMERCIAL, esGLA: true, glam2: "80" },
      { id: "loc-sim", tipo: UnitType.SIMULADOR, esGLA: false, glam2: "20" },
      { id: "loc-esp", tipo: UnitType.ESPACIO, esGLA: false, glam2: "10" },
      { id: "loc-bod", tipo: UnitType.BODEGA, esGLA: false, glam2: "15" }
    ];

    const ingresos = buildIngresoDesglosadoFromContracts(
      contratos,
      locales,
      [{ arrendatarioId: "tenant-var", periodo: "2026-03", ventasPesos: "1000" }],
      [{ periodo: "2026-03", valorUf: "9" }],
      "2026-03",
      1
    );

    expect(ingresos.arriendoFijoUf).toBe(50);
    expect(ingresos.arriendoVariableUf).toBe(80);
    expect(ingresos.simuladoresModulosUf).toBe(30);
    expect(ingresos.arriendoEspacioUf).toBe(12);
    expect(ingresos.arriendoBodegaUf).toBe(10);
    expect(ingresos.ventaEnergiaUf).toBe(9);
    expect(ingresos.totalUf).toBe(191);
    expect(ingresos.facturacionUfM2).toBeCloseTo(1.061, 3);
    expect(ingresos.arriendoFijoUfM2).toBeCloseTo(0.278, 3);
  });

  it("returns zero variable and energy income when no data exists for the period", () => {
    const ingresos = buildIngresoDesglosadoFromContracts(
      [
        makeContract({
          localId: "loc-a",
          localGlam2: "50",
          tarifa: { tipo: ContractRateType.FIJO_UF, valor: "10" }
        })
      ],
      [{ id: "loc-a", tipo: UnitType.LOCAL_COMERCIAL, esGLA: true, glam2: "50" }],
      [],
      [],
      "2026-04"
    );

    expect(ingresos.arriendoVariableUf).toBe(0);
    expect(ingresos.ventaEnergiaUf).toBe(0);
  });

  it("builds ingreso desglosado from accounting pivot mirroring Excel SUMIFS", () => {
    const pivot: AccountingPivotResult = new Map();
    const set = (group3: string, scenario: AccountingScenario, value: number) => {
      pivot.set(buildPivotKey("2026-04", group3, scenario), value);
    };
    // Real: numbers chosen so totals are easy to verify by hand.
    set("ARRIENDO DE LOCAL FIJO", AccountingScenario.REAL, 8500);
    set("ARRIENDO DE LOCAL VARIABLE", AccountingScenario.REAL, 1200);
    set("SIMULADORES Y MODULO", AccountingScenario.REAL, 700);
    set("ARRIENDO DE ESPACIO", AccountingScenario.REAL, 800);
    set("ARRIENDO BODEGA", AccountingScenario.REAL, 200);
    set("INGRESOS POR VENTA DE ENERGIA", AccountingScenario.REAL, 350);
    // Ppto present but should not bleed into Real result.
    set("ARRIENDO DE LOCAL FIJO", AccountingScenario.PPTO, 9000);

    const real = buildIngresoDesglosadoFromAccounting({
      pivot,
      periodo: "2026-04",
      scenario: AccountingScenario.REAL,
      glaArrendadaM2: 1700
    });

    expect(real.arriendoFijoUf).toBe(8500);
    expect(real.arriendoVariableUf).toBe(1200);
    expect(real.simuladoresModulosUf).toBe(700);
    expect(real.arriendoEspacioUf).toBe(800);
    expect(real.arriendoBodegaUf).toBe(200);
    expect(real.ventaEnergiaUf).toBe(350);
    expect(real.totalUf).toBe(11750);
    expect(real.facturacionUfM2).toBeCloseTo(11750 / 1700, 4);
    expect(real.arriendoFijoUfM2).toBeCloseTo(8500 / 1700, 4);

    const ppto = buildIngresoDesglosadoFromAccounting({
      pivot,
      periodo: "2026-04",
      scenario: AccountingScenario.PPTO,
      glaArrendadaM2: 1700
    });
    expect(ppto.arriendoFijoUf).toBe(9000);
    expect(ppto.totalUf).toBe(9000);
  });

  it("returns zeros from accounting pivot when the period has no data", () => {
    const pivot: AccountingPivotResult = new Map();
    const result = buildIngresoDesglosadoFromAccounting({
      pivot,
      periodo: "2026-05",
      scenario: AccountingScenario.REAL,
      glaArrendadaM2: 1000
    });
    expect(result.totalUf).toBe(0);
    expect(result.facturacionUfM2).toBe(0);
    expect(result.arriendoFijoUfM2).toBe(0);
  });

  it("avoids division by zero when GLA arrendada is 0", () => {
    const pivot: AccountingPivotResult = new Map();
    pivot.set(buildPivotKey("2026-04", "ARRIENDO DE LOCAL FIJO", AccountingScenario.REAL), 5000);
    const result = buildIngresoDesglosadoFromAccounting({
      pivot,
      periodo: "2026-04",
      scenario: AccountingScenario.REAL,
      glaArrendadaM2: 0
    });
    expect(result.totalUf).toBe(5000);
    expect(result.facturacionUfM2).toBe(0);
    expect(result.arriendoFijoUfM2).toBe(0);
  });

  it("builds occupancy detail grouped by category and size", () => {
    const locales = [
      {
        id: "l1",
        tipo: UnitType.LOCAL_COMERCIAL,
        esGLA: true,
        glam2: "220",
        zona: "Outdoor"
      },
      {
        id: "l2",
        tipo: UnitType.LOCAL_COMERCIAL,
        esGLA: true,
        glam2: "100",
        zona: "Gastronom\u00eda"
      },
      {
        id: "l3",
        tipo: UnitType.MODULO,
        esGLA: false,
        glam2: "20",
        zona: "Servicios"
      },
      {
        id: "l4",
        tipo: UnitType.BODEGA,
        esGLA: false,
        glam2: "40",
        zona: "Servicios"
      }
    ];
    const contratos = [
      makeContract({ localId: "l1", localGlam2: "220", tarifa: null }),
      makeContract({ localId: "l3", localGlam2: "20", tarifa: null })
    ];

    const detalle = buildOcupacionDetalle(locales, contratos);

    expect(detalle.glaTotal).toBe(320);
    expect(detalle.glaArrendada).toBe(220);
    expect(detalle.glaVacante).toBe(100);
    expect(detalle.porCategoria.Outdoor?.gla).toBe(220);
    expect(detalle.porCategoria.Gastronomia?.gla).toBe(100);
    expect(detalle.porTamano["Tienda Mayor"]?.glaArrendada).toBe(220);
    expect(detalle.porTamano.Modulo?.glaArrendada).toBe(20);
    expect(detalle.porTamano.Bodega?.gla).toBe(40);
  });

  it("builds contract expiries grouped by year with m2 percentages", () => {
    const rows = buildVencimientosPorAnio([
      makeContract({ localGlam2: "100", fechaTermino: new Date("2026-06-01T00:00:00.000Z") }),
      makeContract({ localGlam2: "80", fechaTermino: new Date("2027-07-01T00:00:00.000Z") }),
      makeContract({ localGlam2: "20", fechaTermino: new Date("2027-11-01T00:00:00.000Z") })
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ anio: 2026, cantidadContratos: 1, m2: 100 });
    expect(rows[1]).toMatchObject({ anio: 2027, cantidadContratos: 2, m2: 100 });
    expect(rows[0]?.pctTotal).toBe(50);
    expect(rows[1]?.pctTotal).toBe(50);
  });
});

describe("buildAlertCounts", () => {
  const today = new Date("2026-04-20T00:00:00.000Z");

  it("counts GRACIA and NO_INICIADO contracts into separate buckets", () => {
    const contracts = [
      { estado: ContractStatus.GRACIA, fechaTermino: new Date("2027-01-01T00:00:00.000Z") },
      { estado: ContractStatus.GRACIA, fechaTermino: new Date("2027-01-01T00:00:00.000Z") },
      { estado: ContractStatus.NO_INICIADO, fechaTermino: new Date("2028-01-01T00:00:00.000Z") },
      { estado: ContractStatus.VIGENTE, fechaTermino: new Date("2028-01-01T00:00:00.000Z") }
    ];

    const counts = buildAlertCounts(contracts, [], today);

    expect(counts.enGracia).toBe(2);
    expect(counts.noIniciados).toBe(1);
  });

  it("reports zero counts when no contracts are in grace or not started", () => {
    const counts = buildAlertCounts(
      [{ estado: ContractStatus.VIGENTE, fechaTermino: new Date("2028-01-01T00:00:00.000Z") }],
      [{ id: "l1" }],
      today
    );

    expect(counts.enGracia).toBe(0);
    expect(counts.noIniciados).toBe(0);
    expect(counts.vacantes).toBe(1);
  });
});
