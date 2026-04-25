import type { Prisma } from "@prisma/client";
import { ContractStatus, Prisma as PrismaNS } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertNoOverlappingContracts,
  legacyDiscountFromPayload,
  payloadTarifas,
  persistGGCC,
  persistTarifas,
  tarifaRateOnlyEqual,
  tarifaValuesEqual
} from "@/lib/contracts/persistence";
import { ApiError } from "@/lib/api-error";

type ContractFindManyArgs = {
  where: {
    estado?: { in?: ContractStatus[] };
  };
};

type TxClient = Pick<Prisma.TransactionClient, "contract">;

function makeTx(results: Array<Record<string, unknown>>): {
  tx: TxClient;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(results);
  const tx = { contract: { findMany } } as unknown as TxClient;
  return { tx, findMany };
}

const commonParams = {
  projectId: "p1",
  localIds: ["l1"],
  fechaInicio: "2026-06-01",
  fechaTermino: "2027-05-31",
  diasGracia: 30
};

describe("assertNoOverlappingContracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries contracts with VIGENTE, GRACIA, and NO_INICIADO estados", async () => {
    const { tx, findMany } = makeTx([]);

    await assertNoOverlappingContracts(tx, commonParams);

    const callArgs = findMany.mock.calls[0]?.[0] as ContractFindManyArgs;
    expect(callArgs.where.estado?.in).toEqual(
      expect.arrayContaining([
        ContractStatus.VIGENTE,
        ContractStatus.GRACIA,
        ContractStatus.NO_INICIADO
      ])
    );
  });

  it("throws 409 when a NO_INICIADO contract overlaps on the same local", async () => {
    const overlappingCandidate = {
      id: "existing-1",
      numeroContrato: "CTR-EXIST",
      localId: "l1",
      fechaInicio: new Date("2026-07-01T00:00:00.000Z"),
      fechaTermino: new Date("2027-06-30T00:00:00.000Z"),
      diasGracia: 0,
      local: { codigo: "L-101" },
      locales: []
    };
    const { tx: tx1 } = makeTx([overlappingCandidate]);
    const { tx: tx2 } = makeTx([overlappingCandidate]);

    await expect(assertNoOverlappingContracts(tx1, commonParams)).rejects.toBeInstanceOf(ApiError);
    await expect(assertNoOverlappingContracts(tx2, commonParams)).rejects.toMatchObject({
      status: 409
    });
  });

  it("does not throw when candidate interval does not overlap", async () => {
    const { tx } = makeTx([
      {
        id: "existing-2",
        numeroContrato: "CTR-PAST",
        localId: "l1",
        fechaInicio: new Date("2024-01-01T00:00:00.000Z"),
        fechaTermino: new Date("2025-12-31T00:00:00.000Z"),
        diasGracia: 0,
        local: { codigo: "L-101" },
        locales: []
      }
    ]);

    await expect(assertNoOverlappingContracts(tx, commonParams)).resolves.toBeUndefined();
  });

  it("returns early and does not query when localIds is empty", async () => {
    const { tx, findMany } = makeTx([]);

    await assertNoOverlappingContracts(tx, { ...commonParams, localIds: [] });

    expect(findMany).not.toHaveBeenCalled();
  });
});

type ExistingDiscountFixture = {
  id: string;
  tipo: "PORCENTAJE" | "MONTO_UF";
  valor: string;
  vigenciaDesde: string;
  vigenciaHasta?: string | null;
};

function makeExistingDiscount(d: ExistingDiscountFixture) {
  return {
    id: d.id,
    tipo: d.tipo,
    valor: new PrismaNS.Decimal(d.valor),
    vigenciaDesde: new Date(d.vigenciaDesde),
    vigenciaHasta: d.vigenciaHasta == null ? null : new Date(d.vigenciaHasta)
  };
}

function makeExistingRow(overrides: Partial<{
  id: string;
  tipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
  valor: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  esDiciembre: boolean;
  umbralVentasUf: string | null;
  pisoMinimoUf: string | null;
  discounts: ExistingDiscountFixture[];
}> = {}) {
  return {
    id: overrides.id ?? "rate-1",
    tipo: overrides.tipo ?? ("FIJO_UF_M2" as const),
    valor: new PrismaNS.Decimal(overrides.valor ?? "12.5"),
    umbralVentasUf: overrides.umbralVentasUf ? new PrismaNS.Decimal(overrides.umbralVentasUf) : null,
    pisoMinimoUf: overrides.pisoMinimoUf ? new PrismaNS.Decimal(overrides.pisoMinimoUf) : null,
    vigenciaDesde: new Date(overrides.vigenciaDesde ?? "2026-01-01"),
    vigenciaHasta: overrides.vigenciaHasta === undefined ? null : overrides.vigenciaHasta ? new Date(overrides.vigenciaHasta) : null,
    esDiciembre: overrides.esDiciembre ?? false,
    discounts: (overrides.discounts ?? []).map(makeExistingDiscount)
  };
}

function makePayloadRow(overrides: Partial<{
  tipo: "FIJO_UF_M2" | "FIJO_UF" | "PORCENTAJE";
  valor: string;
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  esDiciembre: boolean;
  umbralVentasUf: string | null;
  pisoMinimoUf: string | null;
  descuentoTipo: "PORCENTAJE" | "MONTO_UF" | null;
  descuentoValor: string | null;
  descuentoDesde: string | null;
  descuentoHasta: string | null;
}> = {}) {
  return {
    tipo: overrides.tipo ?? ("FIJO_UF_M2" as const),
    valor: overrides.valor ?? "12.5",
    umbralVentasUf: overrides.umbralVentasUf ?? null,
    pisoMinimoUf: overrides.pisoMinimoUf ?? null,
    vigenciaDesde: overrides.vigenciaDesde ?? "2026-01-01",
    vigenciaHasta: overrides.vigenciaHasta ?? null,
    esDiciembre: overrides.esDiciembre ?? false,
    descuentoTipo: overrides.descuentoTipo ?? null,
    descuentoValor: overrides.descuentoValor ?? null,
    descuentoDesde: overrides.descuentoDesde ?? null,
    descuentoHasta: overrides.descuentoHasta ?? null
  };
}

describe("tarifaRateOnlyEqual (post-discount-extraction)", () => {
  it("returns true when rate-level values match", () => {
    const existing = makeExistingRow({ valor: "12.50" });
    const payload = makePayloadRow({ valor: "12.5" });
    expect(tarifaRateOnlyEqual(existing, payload)).toBe(true);
  });

  it("returns false when valor differs", () => {
    const existing = makeExistingRow({ valor: "12.5" });
    const payload = makePayloadRow({ valor: "13" });
    expect(tarifaRateOnlyEqual(existing, payload)).toBe(false);
  });

  it("IGNORES discount fields — discounts have their own table now", () => {
    // The payload may carry legacy descuento* fields, but rate-only equality
    // must not consider them. Discount changes go through their own supersession.
    const existing = makeExistingRow({ valor: "12.5" });
    const payload = makePayloadRow({
      valor: "12.5",
      descuentoTipo: "PORCENTAJE",
      descuentoValor: "0.15"
    });
    expect(tarifaRateOnlyEqual(existing, payload)).toBe(true);
  });

  it("returns false when vigenciaHasta changes from null to a date", () => {
    const existing = makeExistingRow({ vigenciaHasta: null });
    const payload = makePayloadRow({ vigenciaHasta: "2027-01-01" });
    expect(tarifaRateOnlyEqual(existing, payload)).toBe(false);
  });

  it("treats null/null pairs as equal", () => {
    const existing = makeExistingRow({ pisoMinimoUf: null, umbralVentasUf: null });
    const payload = makePayloadRow({ pisoMinimoUf: null, umbralVentasUf: null });
    expect(tarifaRateOnlyEqual(existing, payload)).toBe(true);
  });

  it("tarifaValuesEqual is a backward-compat alias", () => {
    // The deprecated alias must produce identical results to tarifaRateOnlyEqual.
    const existing = makeExistingRow({ valor: "12.5" });
    const payload = makePayloadRow({ valor: "12.5" });
    expect(tarifaValuesEqual(existing, payload)).toBe(tarifaRateOnlyEqual(existing, payload));
  });
});

describe("legacyDiscountFromPayload", () => {
  it("returns null when descuentoTipo is missing", () => {
    expect(legacyDiscountFromPayload(makePayloadRow({ descuentoTipo: null }))).toBeNull();
  });

  it("returns null when descuentoValor is missing", () => {
    expect(
      legacyDiscountFromPayload(makePayloadRow({ descuentoTipo: "PORCENTAJE", descuentoValor: null }))
    ).toBeNull();
  });

  it("falls back to rate's vigenciaDesde when descuentoDesde is null", () => {
    const result = legacyDiscountFromPayload(
      makePayloadRow({
        vigenciaDesde: "2026-01-01",
        descuentoTipo: "PORCENTAJE",
        descuentoValor: "0.10"
      })
    );
    expect(result).toEqual({
      tipo: "PORCENTAJE",
      valor: "0.10",
      vigenciaDesde: "2026-01-01",
      vigenciaHasta: null
    });
  });

  it("uses explicit descuentoDesde / descuentoHasta when provided", () => {
    const result = legacyDiscountFromPayload(
      makePayloadRow({
        vigenciaDesde: "2026-01-01",
        descuentoTipo: "MONTO_UF",
        descuentoValor: "5",
        descuentoDesde: "2026-06-01",
        descuentoHasta: "2026-09-30"
      })
    );
    expect(result).toEqual({
      tipo: "MONTO_UF",
      valor: "5",
      vigenciaDesde: "2026-06-01",
      vigenciaHasta: "2026-09-30"
    });
  });
});

type ContractRateTx = {
  contractRate: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  contractRateDiscount: {
    updateMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

function makeRateTx(existingActive: ReturnType<typeof makeExistingRow>[]): ContractRateTx {
  return {
    contractRate: {
      findMany: vi.fn().mockResolvedValue(existingActive),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    contractRateDiscount: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 })
    }
  };
}

const FIXED_NOW = new Date("2026-04-25T10:00:00Z");

describe("persistTarifas (supersession)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only active rows AND their active discounts", async () => {
    const tx = makeRateTx([]);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: null,
      now: FIXED_NOW
    });

    expect(tx.contractRate.findMany).toHaveBeenCalledWith({
      where: { contratoId: "c1", supersededAt: null },
      include: { discounts: { where: { supersededAt: null } } }
    });
  });

  it("no-ops when payload matches existing (no updates, no inserts)", async () => {
    const existing = [
      makeExistingRow({
        id: "rate-stable",
        valor: "12.5",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: null
      })
    ];
    const tx = makeRateTx(existing);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "12.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          descuentoTipo: null,
          descuentoValor: null,
          descuentoDesde: null,
          descuentoHasta: null
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: null,
      now: FIXED_NOW
    });

    expect(tx.contractRate.updateMany).not.toHaveBeenCalled();
    expect(tx.contractRate.createMany).not.toHaveBeenCalled();
  });

  it("supersedes + inserts when valor changes for the same key", async () => {
    const existing = [
      makeExistingRow({
        id: "rate-old",
        valor: "12.5",
        vigenciaDesde: "2026-01-01"
      })
    ];
    const tx = makeRateTx(existing);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "13.0",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          descuentoTipo: null,
          descuentoValor: null,
          descuentoDesde: null,
          descuentoHasta: null
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: "a1",
      supersedeReason: "Anexo 2026-04",
      now: FIXED_NOW
    });

    expect(tx.contractRate.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["rate-old"] } },
      data: {
        supersededAt: FIXED_NOW,
        supersededBy: "u1",
        supersedeReason: "Anexo 2026-04",
        amendmentId: "a1"
      }
    });
    expect(tx.contractRate.createMany).toHaveBeenCalledTimes(1);
    const createArg = tx.contractRate.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(createArg.data).toHaveLength(1);
    expect(createArg.data[0].amendmentId).toBe("a1");
    expect(createArg.data[0].valor).toEqual(new PrismaNS.Decimal("13.0"));
  });

  it("supersedes (logical delete) when an existing row is absent from payload", async () => {
    const existing = [
      makeExistingRow({ id: "rate-keep", valor: "12.5", vigenciaDesde: "2026-01-01" }),
      makeExistingRow({
        id: "rate-drop",
        tipo: "FIJO_UF",
        valor: "150",
        vigenciaDesde: "2026-02-01"
      })
    ];
    const tx = makeRateTx(existing);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "12.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          descuentoTipo: null,
          descuentoValor: null,
          descuentoDesde: null,
          descuentoHasta: null
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: null,
      now: FIXED_NOW
    });

    expect(tx.contractRate.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["rate-drop"] } },
      data: expect.objectContaining({
        supersededAt: FIXED_NOW,
        supersededBy: "u1",
        amendmentId: null
      })
    });
    expect(tx.contractRate.createMany).not.toHaveBeenCalled();
  });

  it("inserts new payload rows that do not match any existing key", async () => {
    const tx = makeRateTx([]);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "12.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          descuentoTipo: null,
          descuentoValor: null,
          descuentoDesde: null,
          descuentoHasta: null
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: null,
      now: FIXED_NOW
    });

    expect(tx.contractRate.updateMany).not.toHaveBeenCalled();
    expect(tx.contractRate.createMany).toHaveBeenCalledTimes(1);
    const createArg = tx.contractRate.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(createArg.data).toHaveLength(1);
    expect(createArg.data[0].amendmentId).toBeNull();
  });

  it("does NOT write legacy descuento* columns (always NULL on new rows)", async () => {
    const tx = makeRateTx([]);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "12.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          descuentoTipo: "PORCENTAJE",
          descuentoValor: "0.10",
          descuentoDesde: null,
          descuentoHasta: null
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: null,
      now: FIXED_NOW
    });

    const createArg = tx.contractRate.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    // Discount info must NOT leak into ContractRate columns — it lives in the
    // discounts table now. The createMany payload for ContractRate must be free
    // of descuentoTipo / descuentoValor / descuentoDesde / descuentoHasta.
    expect(createArg.data[0]).not.toHaveProperty("descuentoTipo");
    expect(createArg.data[0]).not.toHaveProperty("descuentoValor");
    expect(createArg.data[0]).not.toHaveProperty("descuentoDesde");
    expect(createArg.data[0]).not.toHaveProperty("descuentoHasta");
  });

  it("creates a ContractRateDiscount row when the new rate has a discount", async () => {
    const tx = makeRateTx([]);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "12.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          descuentoTipo: "PORCENTAJE",
          descuentoValor: "0.10",
          descuentoDesde: "2026-06-01",
          descuentoHasta: "2026-09-30"
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: "a1",
      now: FIXED_NOW
    });

    expect(tx.contractRateDiscount.createMany).toHaveBeenCalledTimes(1);
    const discountInsert = tx.contractRateDiscount.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(discountInsert.data).toHaveLength(1);
    expect(discountInsert.data[0]).toMatchObject({
      tipo: "PORCENTAJE",
      amendmentId: "a1"
    });
    // The new discount row must reference the freshly-created rate's id (a UUID
    // pre-generated in persistTarifas so we can link without a round-trip).
    const rateInsert = tx.contractRate.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(discountInsert.data[0].contractRateId).toBe(rateInsert.data[0].id);
  });

  it("discount-only change supersedes ONLY the discount, not the parent rate", async () => {
    // Rate is unchanged; only the embedded discount value changes. The rate row
    // must remain active. Only the active discount gets superseded + replaced.
    const existing = [
      makeExistingRow({
        id: "rate-stable",
        valor: "12.5",
        vigenciaDesde: "2026-01-01",
        discounts: [
          {
            id: "disc-old",
            tipo: "PORCENTAJE",
            valor: "0.10",
            vigenciaDesde: "2026-01-01",
            vigenciaHasta: null
          }
        ]
      })
    ];
    const tx = makeRateTx(existing);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "12.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          descuentoTipo: "PORCENTAJE",
          descuentoValor: "0.15", // changed from 0.10
          descuentoDesde: null,
          descuentoHasta: null
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: "a1",
      now: FIXED_NOW
    });

    // Rate stays untouched.
    expect(tx.contractRate.updateMany).not.toHaveBeenCalled();
    expect(tx.contractRate.createMany).not.toHaveBeenCalled();
    // Discount: old superseded, new inserted on the SAME rate id.
    expect(tx.contractRateDiscount.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["disc-old"] } },
      data: expect.objectContaining({ supersededAt: FIXED_NOW, supersededBy: "u1", amendmentId: "a1" })
    });
    expect(tx.contractRateDiscount.createMany).toHaveBeenCalledTimes(1);
    const insertArg = tx.contractRateDiscount.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(insertArg.data[0].contractRateId).toBe("rate-stable");
    expect(insertArg.data[0].valor).toEqual(new PrismaNS.Decimal("0.15"));
  });

  it("removing the discount supersedes the discount, keeps the rate", async () => {
    const existing = [
      makeExistingRow({
        id: "rate-stable",
        valor: "12.5",
        vigenciaDesde: "2026-01-01",
        discounts: [
          {
            id: "disc-old",
            tipo: "PORCENTAJE",
            valor: "0.10",
            vigenciaDesde: "2026-01-01",
            vigenciaHasta: null
          }
        ]
      })
    ];
    const tx = makeRateTx(existing);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "12.5",
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          // no discount this time
          descuentoTipo: null,
          descuentoValor: null,
          descuentoDesde: null,
          descuentoHasta: null
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: null,
      now: FIXED_NOW
    });

    expect(tx.contractRate.updateMany).not.toHaveBeenCalled();
    expect(tx.contractRate.createMany).not.toHaveBeenCalled();
    expect(tx.contractRateDiscount.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["disc-old"] } },
      data: expect.objectContaining({ supersededAt: FIXED_NOW })
    });
    expect(tx.contractRateDiscount.createMany).not.toHaveBeenCalled();
  });

  it("when a rate is superseded, its active discounts are superseded together", async () => {
    const existing = [
      makeExistingRow({
        id: "rate-old",
        valor: "12.5",
        vigenciaDesde: "2026-01-01",
        discounts: [
          {
            id: "disc-of-old",
            tipo: "PORCENTAJE",
            valor: "0.10",
            vigenciaDesde: "2026-01-01",
            vigenciaHasta: null
          }
        ]
      })
    ];
    const tx = makeRateTx(existing);
    const tarifas = payloadTarifas({
      localId: "l1",
      localIds: ["l1"],
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "13.0", // rate value changed
          vigenciaDesde: "2026-01-01",
          vigenciaHasta: null,
          esDiciembre: false,
          descuentoTipo: null,
          descuentoValor: null,
          descuentoDesde: null,
          descuentoHasta: null
        }
      ],
      rentaVariable: [],
      ggcc: [],
      fechaInicio: "2026-01-01",
      fechaTermino: "2026-12-31"
    });

    await persistTarifas(tx as unknown as Prisma.TransactionClient, "c1", tarifas, {
      userId: "u1",
      amendmentId: null,
      now: FIXED_NOW
    });

    expect(tx.contractRate.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["rate-old"] } },
      data: expect.objectContaining({ supersededAt: FIXED_NOW })
    });
    // Cascade: the rate's active discount must also be superseded together.
    expect(tx.contractRateDiscount.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["disc-of-old"] } },
      data: expect.objectContaining({ supersededAt: FIXED_NOW })
    });
  });
});

type GgccTx = {
  contractCommonExpense: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

function makeGgccTx(existingActive: Array<Record<string, unknown>>): GgccTx {
  return {
    contractCommonExpense: {
      findMany: vi.fn().mockResolvedValue(existingActive),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 })
    }
  };
}

function makeExistingGgcc(overrides: Partial<{
  id: string;
  tarifaBaseUfM2: string;
  pctAdministracion: string;
  pctReajuste: string | null;
  proximoReajuste: string | null;
  mesesReajuste: number | null;
}> = {}) {
  return {
    id: overrides.id ?? "ggcc-1",
    tarifaBaseUfM2: new PrismaNS.Decimal(overrides.tarifaBaseUfM2 ?? "0.5"),
    pctAdministracion: new PrismaNS.Decimal(overrides.pctAdministracion ?? "10"),
    pctReajuste: overrides.pctReajuste === null
      ? null
      : overrides.pctReajuste !== undefined
        ? new PrismaNS.Decimal(overrides.pctReajuste)
        : null,
    proximoReajuste: overrides.proximoReajuste === null
      ? null
      : overrides.proximoReajuste !== undefined
        ? new Date(overrides.proximoReajuste)
        : null,
    mesesReajuste: overrides.mesesReajuste === undefined ? null : overrides.mesesReajuste
  };
}

describe("persistGGCC (atomic-set supersession)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads only active rows (filters supersededAt: null)", async () => {
    const tx = makeGgccTx([]);
    await persistGGCC(
      tx as unknown as Prisma.TransactionClient,
      "c1",
      [],
      "2026-01-01",
      "2026-12-31",
      { userId: "u1", amendmentId: null, now: FIXED_NOW }
    );
    expect(tx.contractCommonExpense.findMany).toHaveBeenCalledWith({
      where: { contratoId: "c1", supersededAt: null }
    });
  });

  it("no-ops when payload set equals existing set", async () => {
    const existing = [makeExistingGgcc({ tarifaBaseUfM2: "0.5", pctAdministracion: "10" })];
    const tx = makeGgccTx(existing);
    await persistGGCC(
      tx as unknown as Prisma.TransactionClient,
      "c1",
      [
        {
          tarifaBaseUfM2: "0.5",
          pctAdministracion: "10",
          pctReajuste: null,
          proximoReajuste: null,
          mesesReajuste: null
        }
      ],
      "2026-01-01",
      "2026-12-31",
      { userId: "u1", amendmentId: null, now: FIXED_NOW }
    );
    expect(tx.contractCommonExpense.updateMany).not.toHaveBeenCalled();
    expect(tx.contractCommonExpense.createMany).not.toHaveBeenCalled();
  });

  it("supersedes all + inserts all when any field changes (atomic replacement)", async () => {
    const existing = [makeExistingGgcc({ id: "ggcc-old", tarifaBaseUfM2: "0.5", pctAdministracion: "10" })];
    const tx = makeGgccTx(existing);
    await persistGGCC(
      tx as unknown as Prisma.TransactionClient,
      "c1",
      [
        {
          tarifaBaseUfM2: "0.6",
          pctAdministracion: "12",
          pctReajuste: null,
          proximoReajuste: null,
          mesesReajuste: null
        }
      ],
      "2026-01-01",
      "2026-12-31",
      { userId: "u1", amendmentId: "a1", supersedeReason: "Anexo", now: FIXED_NOW }
    );

    expect(tx.contractCommonExpense.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["ggcc-old"] } },
      data: {
        supersededAt: FIXED_NOW,
        supersededBy: "u1",
        supersedeReason: "Anexo",
        amendmentId: "a1"
      }
    });
    const createArg = tx.contractCommonExpense.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(createArg.data).toHaveLength(1);
    expect(createArg.data[0].amendmentId).toBe("a1");
    expect(createArg.data[0].tarifaBaseUfM2).toEqual(new PrismaNS.Decimal("0.6"));
  });

  it("supersedes all without inserting when payload is empty", async () => {
    const existing = [makeExistingGgcc({ id: "ggcc-old" })];
    const tx = makeGgccTx(existing);
    await persistGGCC(
      tx as unknown as Prisma.TransactionClient,
      "c1",
      [],
      "2026-01-01",
      "2026-12-31",
      { userId: "u1", amendmentId: null, now: FIXED_NOW }
    );
    expect(tx.contractCommonExpense.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["ggcc-old"] } } })
    );
    expect(tx.contractCommonExpense.createMany).not.toHaveBeenCalled();
  });

  it("inserts without superseding when there are no existing active rows", async () => {
    const tx = makeGgccTx([]);
    await persistGGCC(
      tx as unknown as Prisma.TransactionClient,
      "c1",
      [
        {
          tarifaBaseUfM2: "0.5",
          pctAdministracion: "10",
          pctReajuste: null,
          proximoReajuste: null,
          mesesReajuste: null
        }
      ],
      "2026-01-01",
      "2026-12-31",
      { userId: "u1", amendmentId: null, now: FIXED_NOW }
    );
    expect(tx.contractCommonExpense.updateMany).not.toHaveBeenCalled();
    expect(tx.contractCommonExpense.createMany).toHaveBeenCalledTimes(1);
  });
});
