import { describe, expect, it } from "vitest";
import { ContractStatus, MasterStatus, UnitType } from "@prisma/client";
import {
  attributeSalesToLocal,
  buildLocal360Data,
  type RawContractWithTenant,
  type RawTenantContractFootprint,
  type RawUnit,
} from "./local-360";

function baseUnit(overrides: Partial<RawUnit> = {}): RawUnit {
  return {
    id: "unit-1",
    codigo: "L-101",
    nombre: "Local 101",
    glam2: "100",
    piso: "1",
    tipo: UnitType.LOCAL_COMERCIAL,
    zonaId: "zone-1",
    zona: { nombre: "Zona Centro" },
    categoriaTamano: "Mediano",
    esGLA: true,
    estado: MasterStatus.ACTIVO,
    ...overrides,
  };
}

function makeContract(args: {
  id: string;
  tenantId: string;
  tenantName: string;
  fechaInicio?: Date;
  fechaTermino?: Date;
  estado?: ContractStatus;
}): RawContractWithTenant {
  return {
    id: args.id,
    arrendatarioId: args.tenantId,
    arrendatario: {
      id: args.tenantId,
      rut: `RUT-${args.tenantId}`,
      razonSocial: args.tenantName,
      nombreComercial: args.tenantName,
    },
    numeroContrato: `C-${args.id}`,
    localId: "unit-1",
    local: {
      id: "unit-1",
      codigo: "L-101",
      nombre: "Local 101",
      glam2: "100",
      esGLA: true,
    },
    estado: args.estado ?? ContractStatus.TERMINADO,
    fechaInicio: args.fechaInicio ?? new Date("2024-01-01"),
    fechaTermino: args.fechaTermino ?? new Date("2024-12-31"),
    fechaEntrega: null,
    fechaApertura: null,
    diasGracia: 0,
    multiplicadorDiciembre: null,
    multiplicadorJunio: null,
    multiplicadorJulio: null,
    multiplicadorAgosto: null,
    pctFondoPromocion: null,
    codigoCC: null,
    pdfUrl: null,
    notas: null,
    tarifas: [
      {
        tipo: "FIJO_UF_M2",
        valor: "1",
        umbralVentasUf: null,
        vigenciaDesde: args.fechaInicio ?? new Date("2024-01-01"),
        vigenciaHasta: args.fechaTermino ?? new Date("2024-12-31"),
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null,
      },
    ],
    ggcc: [],
    anexos: [],
  };
}

describe("attributeSalesToLocal", () => {
  it("returns full tenant sales when tenant has only this local", () => {
    const footprints: RawTenantContractFootprint[] = [
      {
        arrendatarioId: "t1",
        localId: "unit-1",
        glam2: "100",
        fechaInicio: new Date("2024-01-01"),
        fechaTermino: new Date("2024-12-31"),
      },
    ];
    const result = attributeSalesToLocal({
      thisUnitId: "unit-1",
      thisGlam2: 100,
      tenantFootprints: footprints,
      rawSales: [{ tenantId: "t1", period: new Date("2024-03-01"), salesPesos: "1000" }],
      periods: ["2024-03"],
    });
    expect(result).toHaveLength(1);
    expect(Number(result[0].salesPesos)).toBe(1000);
  });

  it("distributes sales by GLA when tenant occupies multiple locals", () => {
    const footprints: RawTenantContractFootprint[] = [
      {
        arrendatarioId: "t1",
        localId: "unit-1",
        glam2: "100",
        fechaInicio: new Date("2024-01-01"),
        fechaTermino: new Date("2024-12-31"),
      },
      {
        arrendatarioId: "t1",
        localId: "unit-2",
        glam2: "300",
        fechaInicio: new Date("2024-01-01"),
        fechaTermino: new Date("2024-12-31"),
      },
    ];
    const result = attributeSalesToLocal({
      thisUnitId: "unit-1",
      thisGlam2: 100,
      tenantFootprints: footprints,
      rawSales: [{ tenantId: "t1", period: new Date("2024-03-01"), salesPesos: "1000" }],
      periods: ["2024-03"],
    });
    expect(result).toHaveLength(1);
    // 100 / 400 = 0.25 share
    expect(Number(result[0].salesPesos)).toBe(250);
  });

  it("excludes sales when tenant did not occupy this local in the period", () => {
    const footprints: RawTenantContractFootprint[] = [
      {
        arrendatarioId: "t1",
        localId: "unit-2",
        glam2: "100",
        fechaInicio: new Date("2024-01-01"),
        fechaTermino: new Date("2024-12-31"),
      },
    ];
    const result = attributeSalesToLocal({
      thisUnitId: "unit-1",
      thisGlam2: 100,
      tenantFootprints: footprints,
      rawSales: [{ tenantId: "t1", period: new Date("2024-03-01"), salesPesos: "1000" }],
      periods: ["2024-03"],
    });
    expect(result).toHaveLength(0);
  });
});

describe("buildLocal360Data", () => {
  const periods = ["2024-01", "2024-02", "2024-03"];
  const rangeFromDate = new Date("2024-01-01");
  const rangeToDate = new Date("2024-03-31");

  it("returns chronological tenant history sorted by fechaInicio asc", () => {
    const contracts: RawContractWithTenant[] = [
      makeContract({
        id: "c2",
        tenantId: "t2",
        tenantName: "Second",
        fechaInicio: new Date("2024-07-01"),
        fechaTermino: new Date("2024-12-31"),
      }),
      makeContract({
        id: "c1",
        tenantId: "t1",
        tenantName: "First",
        fechaInicio: new Date("2024-01-01"),
        fechaTermino: new Date("2024-06-30"),
      }),
    ];
    const data = buildLocal360Data({
      unit: baseUnit(),
      contracts,
      accountingRecords: [],
      attributedSales: [],
      contractDays: [],
      energyEntries: [],
      peerStats: [],
      latestUf: null,
      periods,
      rangeFromDate,
      rangeToDate,
    });
    expect(data.tenantHistory).toHaveLength(2);
    expect(data.tenantHistory[0].tenantName).toBe("First");
    expect(data.tenantHistory[1].tenantName).toBe("Second");
  });

  it("counts unique tenants across the local's history", () => {
    const contracts: RawContractWithTenant[] = [
      makeContract({ id: "c1", tenantId: "t1", tenantName: "A" }),
      makeContract({ id: "c2", tenantId: "t2", tenantName: "B" }),
      makeContract({ id: "c3", tenantId: "t1", tenantName: "A" }), // re-occupation by same tenant
    ];
    const data = buildLocal360Data({
      unit: baseUnit(),
      contracts,
      accountingRecords: [],
      attributedSales: [],
      contractDays: [],
      energyEntries: [],
      peerStats: [],
      latestUf: null,
      periods,
      rangeFromDate,
      rangeToDate,
    });
    expect(data.quickStats.totalUniqueTenants).toBe(2);
  });

  it("aggregates occupancy by month from contractDays", () => {
    const contractDays = [
      { localId: "unit-1", fecha: new Date("2024-01-15"), estadoDia: "OCUPADO" as const, glam2: "100" },
      { localId: "unit-1", fecha: new Date("2024-01-16"), estadoDia: "OCUPADO" as const, glam2: "100" },
      { localId: "unit-1", fecha: new Date("2024-01-17"), estadoDia: "GRACIA" as const, glam2: "100" },
      { localId: "unit-1", fecha: new Date("2024-02-01"), estadoDia: "VACANTE" as const, glam2: "100" },
    ];
    const data = buildLocal360Data({
      unit: baseUnit(),
      contracts: [],
      accountingRecords: [],
      attributedSales: [],
      contractDays,
      energyEntries: [],
      peerStats: [],
      latestUf: null,
      periods,
      rangeFromDate,
      rangeToDate,
    });
    const jan = data.occupancyTimeline.find((p) => p.period === "2024-01");
    const feb = data.occupancyTimeline.find((p) => p.period === "2024-02");
    expect(jan?.daysOccupied).toBe(2);
    expect(jan?.daysGrace).toBe(1);
    expect(jan?.occupancyPct).toBeCloseTo(100);
    expect(feb?.daysVacant).toBe(1);
    expect(feb?.occupancyPct).toBe(0);
  });

  it("computes peer comparison ranking position", () => {
    const peerStats = [
      { unitId: "unit-2", codigo: "L-102", glam2: "100", totalBillingUf: 100 }, // 1.0/m2
      { unitId: "unit-3", codigo: "L-103", glam2: "100", totalBillingUf: 50 },  // 0.5/m2
      { unitId: "unit-4", codigo: "L-104", glam2: "100", totalBillingUf: 200 }, // 2.0/m2
    ];
    const accountingRecords = [
      // this local: total 150 UF over the periods → 150/100 = 1.5/m²
      { unitId: "unit-1", period: new Date("2024-01-01"), group1: "INGRESOS DE EXPLOTACION", group3: "Renta", denomination: "x", valueUf: "150" },
    ];
    const data = buildLocal360Data({
      unit: baseUnit(),
      contracts: [],
      accountingRecords,
      attributedSales: [],
      contractDays: [],
      energyEntries: [],
      peerStats,
      latestUf: null,
      periods,
      rangeFromDate,
      rangeToDate,
    });
    expect(data.peerComparison).not.toBeNull();
    expect(data.peerComparison!.peerCount).toBe(3);
    // rankings (desc by uf/m2): unit-4 (2.0), unit-1 this (1.5), unit-2 (1.0), unit-3 (0.5)
    expect(data.peerComparison!.rankBilling.position).toBe(2);
    expect(data.peerComparison!.rankBilling.total).toBe(4);
  });

  it("returns null peer comparison when no peers", () => {
    const data = buildLocal360Data({
      unit: baseUnit(),
      contracts: [],
      accountingRecords: [],
      attributedSales: [],
      contractDays: [],
      energyEntries: [],
      peerStats: [],
      latestUf: null,
      periods,
      rangeFromDate,
      rangeToDate,
    });
    expect(data.peerComparison).toBeNull();
  });

  it("aggregates energy timeline per period", () => {
    const energyEntries = [
      { periodo: new Date("2024-01-01"), valorUf: "10" },
      { periodo: new Date("2024-01-15"), valorUf: "5" },
      { periodo: new Date("2024-02-01"), valorUf: "8" },
    ];
    const data = buildLocal360Data({
      unit: baseUnit(),
      contracts: [],
      accountingRecords: [],
      attributedSales: [],
      contractDays: [],
      energyEntries,
      peerStats: [],
      latestUf: null,
      periods,
      rangeFromDate,
      rangeToDate,
    });
    expect(data.energyTimeline.find((e) => e.period === "2024-01")?.costoUf).toBe(15);
    expect(data.energyTimeline.find((e) => e.period === "2024-02")?.costoUf).toBe(8);
    expect(data.energyTimeline.find((e) => e.period === "2024-03")?.costoUf).toBe(0);
  });
});
