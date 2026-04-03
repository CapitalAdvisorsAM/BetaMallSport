import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContractFormPayload } from "@/types";

const { requireSessionMock, requireWriteAccessMock, prismaMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  requireWriteAccessMock: vi.fn(),
  prismaMock: {
    local: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    arrendatario: {
      findFirst: vi.fn()
    },
    contrato: {
      findFirst: vi.fn(),
      deleteMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock,
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

async function callPut(request: Request, params: { id: string }) {
  const { PUT } = await import("./route");
  return PUT(request, { params });
}

async function callGet(request: Request, params: { id: string }) {
  const { GET } = await import("./route");
  return GET(request, { params });
}

async function callDelete(request: Request, params: { id: string }) {
  const { DELETE } = await import("./route");
  return DELETE(request, { params });
}

function makePayload(): ContractFormPayload {
  return {
    proyectoId: "p1",
    localId: "l1",
    localIds: ["l1"],
    arrendatarioId: "a1",
    numeroContrato: "C-100",
    fechaInicio: "2026-01-01",
    fechaTermino: "2026-12-31",
    fechaEntrega: null,
    fechaApertura: null,
    estado: "VIGENTE",
    rentaVariable: [
      {
        pctRentaVariable: "5",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: null
      }
    ],
    pctFondoPromocion: "2",
    pctAdministracionGgcc: null,
    multiplicadorDiciembre: null,
    codigoCC: "CC-1",
    pdfUrl: "https://example.com/contract.pdf",
    notas: "Notas",
    tarifas: [
      {
        tipo: "FIJO_UF_M2",
        valor: "12.5",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: null,
        esDiciembre: false
      }
    ],
    ggcc: [
      {
        tarifaBaseUfM2: "1.25",
        pctAdministracion: "8",
        pctReajuste: null,
        proximoReajuste: null,
        mesesReajuste: null
      }
    ],
    anexo: null
  };
}

function makeExistingContract() {
  return {
    id: "contract-1",
    proyectoId: "p1",
    localId: "l1",
    arrendatarioId: "a1",
    numeroContrato: "C-100",
    fechaInicio: new Date("2026-01-01"),
    fechaTermino: new Date("2026-12-31"),
    fechaEntrega: null,
    fechaApertura: null,
    estado: "VIGENTE" as const,
    pctFondoPromocion: new Prisma.Decimal("2"),
    pctAdministracionGgcc: null,
    multiplicadorDiciembre: null,
    codigoCC: "CC-1",
    pdfUrl: "https://example.com/contract.pdf",
    notas: "Notas",
    locales: [{ id: "cl-1", contratoId: "contract-1", localId: "l1", createdAt: new Date("2026-01-01") }],
    tarifas: [
      {
        id: "tarifa-keep",
        contratoId: "contract-1",
        tipo: "FIJO_UF_M2" as const,
        valor: new Prisma.Decimal("12.5"),
        vigenciaDesde: new Date("2026-01-01"),
        vigenciaHasta: null,
        esDiciembre: false,
        createdAt: new Date("2026-01-01")
      },
      {
        id: "tarifa-remove",
        contratoId: "contract-1",
        tipo: "FIJO_UF" as const,
        valor: new Prisma.Decimal("150"),
        vigenciaDesde: new Date("2026-02-01"),
        vigenciaHasta: null,
        esDiciembre: false,
        createdAt: new Date("2026-02-01")
      }
    ],
    ggcc: [
      {
        id: "ggcc-keep",
        contratoId: "contract-1",
        tarifaBaseUfM2: new Prisma.Decimal("1.25"),
        pctAdministracion: new Prisma.Decimal("8"),
        pctReajuste: null,
        vigenciaDesde: new Date("2026-01-01"),
        vigenciaHasta: null,
        proximoReajuste: null,
        mesesReajuste: null,
        createdAt: new Date("2026-01-01")
      },
      {
        id: "ggcc-remove",
        contratoId: "contract-1",
        tarifaBaseUfM2: new Prisma.Decimal("2"),
        pctAdministracion: new Prisma.Decimal("10"),
        pctReajuste: null,
        vigenciaDesde: new Date("2026-03-01"),
        vigenciaHasta: null,
        proximoReajuste: null,
        mesesReajuste: null,
        createdAt: new Date("2026-03-01")
      }
    ]
  };
}

function setupTransaction(options: {
  existingTarifas?: unknown[];
  existingGgcc?: unknown[];
  existingLocales?: unknown[];
  finalContract: unknown;
}) {
  const tx = {
    contrato: {
      update: vi.fn().mockResolvedValue({ id: "contract-1" }),
      findUnique: vi.fn().mockResolvedValue(options.finalContract)
    },
    contratoTarifa: {
      findMany: vi.fn().mockResolvedValue(options.existingTarifas ?? []),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    contratoLocal: {
      findMany: vi.fn().mockResolvedValue(options.existingLocales ?? []),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    contratoGGCC: {
      findMany: vi.fn().mockResolvedValue(options.existingGgcc ?? []),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    contratoAnexo: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  return tx;
}

beforeEach(() => {
  requireSessionMock.mockResolvedValue({ user: { id: "u1" } });
  requireWriteAccessMock.mockResolvedValue({ user: { id: "u1" } });
  prismaMock.local.findFirst.mockResolvedValue({ id: "l1" });
  prismaMock.local.findMany.mockResolvedValue([{ id: "l1" }]);
  prismaMock.arrendatario.findFirst.mockResolvedValue({ id: "a1" });
  prismaMock.local.findFirst.mockClear();
  prismaMock.local.findMany.mockClear();
  prismaMock.arrendatario.findFirst.mockClear();
  prismaMock.contrato.findFirst.mockReset();
  prismaMock.contrato.deleteMany.mockReset();
  prismaMock.$transaction.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("PUT /api/contracts/[id]", () => {
  it("deletes tarifas removed from payload", async () => {
    const existing = makeExistingContract();
    const payload = makePayload();
    prismaMock.contrato.findFirst.mockResolvedValue(existing);

    const tx = setupTransaction({
      existingTarifas: existing.tarifas,
      existingGgcc: [existing.ggcc[0]],
      finalContract: { id: "contract-1", tarifas: [existing.tarifas[0]], ggcc: [existing.ggcc[0]] }
    });

    const response = await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
      { id: "contract-1" }
    );

    expect(response.status).toBe(200);
    expect(tx.contratoTarifa.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["tarifa-remove"]
        }
      }
    });
  });

  it("deletes GGCC rows removed from payload", async () => {
    const existing = makeExistingContract();
    const payload = makePayload();
    payload.ggcc = [payload.ggcc[0]];

    prismaMock.contrato.findFirst.mockResolvedValue(existing);
    const tx = setupTransaction({
      existingTarifas: [existing.tarifas[0]],
      existingGgcc: existing.ggcc,
      finalContract: { id: "contract-1", tarifas: [existing.tarifas[0]], ggcc: [existing.ggcc[0]] }
    });

    const response = await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
      { id: "contract-1" }
    );

    expect(response.status).toBe(200);
    expect(tx.contratoGGCC.deleteMany).toHaveBeenCalledWith({
      where: { contratoId: "contract-1" }
    });
  });

  it("returns 400 with zod issues for invalid payload", async () => {
    const invalidPayload = { foo: "bar" };

    const response = await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidPayload)
      }),
      { id: "contract-1" }
    );

    const data = (await response.json()) as { message: string; issues: unknown[] };
    expect(response.status).toBe(400);
    expect(data.message).toBe("Payload invalido");
    expect(Array.isArray(data.issues)).toBe(true);
    expect(prismaMock.contrato.findFirst).not.toHaveBeenCalled();
  });

  it("returns 400 when rentaVariable has duplicate vigenciaDesde", async () => {
    const payload = makePayload();
    payload.rentaVariable = [
      payload.rentaVariable[0],
      {
        pctRentaVariable: "6",
        vigenciaDesde: payload.rentaVariable[0].vigenciaDesde,
        vigenciaHasta: null
      }
    ];

    const response = await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
      { id: "contract-1" }
    );

    expect(response.status).toBe(400);
    expect(prismaMock.contrato.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when proyectoId does not match the existing contract", async () => {
    const payload = makePayload();
    payload.proyectoId = "other-project";
    prismaMock.contrato.findFirst.mockResolvedValue(null);

    const response = await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
      { id: "contract-1" }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("stores real camposModificados top-level keys", async () => {
    const existing = makeExistingContract();
    const existingAligned = {
      ...existing,
      tarifas: [existing.tarifas[0]],
      ggcc: [existing.ggcc[0]]
    };
    const payload = makePayload();
    payload.estado = "TERMINADO";
    payload.fechaTermino = "2027-01-31";
    payload.anexo = { fecha: "2026-04-01", descripcion: "Cambio de estado y fechas" };

    prismaMock.contrato.findFirst.mockResolvedValue(existingAligned);
    const tx = setupTransaction({
      existingTarifas: [existingAligned.tarifas[0]],
      existingGgcc: [existingAligned.ggcc[0]],
      finalContract: { id: "contract-1", tarifas: [existingAligned.tarifas[0]], ggcc: [existingAligned.ggcc[0]] }
    });

    await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
      { id: "contract-1" }
    );

    expect(tx.contratoAnexo.create).toHaveBeenCalledTimes(1);
    const anexoPayload = tx.contratoAnexo.create.mock.calls[0][0].data as { camposModificados: string[] };
    expect(anexoPayload.camposModificados).toEqual(expect.arrayContaining(["estado", "fechaTermino", "anexo"]));
    expect(anexoPayload.camposModificados).not.toContain("tarifas");
    expect(anexoPayload.camposModificados).not.toContain("ggcc");
  });

  it("stores snapshotDespues including tarifas and ggcc", async () => {
    const existing = makeExistingContract();
    const payload = makePayload();
    payload.anexo = { fecha: "2026-05-01", descripcion: "Snapshot completo" };

    const finalContract = {
      id: "contract-1",
      numeroContrato: "C-100",
      tarifas: [existing.tarifas[0]],
      ggcc: [existing.ggcc[0]]
    };

    prismaMock.contrato.findFirst.mockResolvedValue(existing);
    const tx = setupTransaction({
      existingTarifas: [existing.tarifas[0]],
      existingGgcc: [existing.ggcc[0]],
      finalContract
    });

    await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
      { id: "contract-1" }
    );

    const anexoPayload = tx.contratoAnexo.create.mock.calls[0][0].data as { snapshotDespues: typeof finalContract };
    expect(anexoPayload.snapshotDespues.tarifas).toBeDefined();
    expect(anexoPayload.snapshotDespues.ggcc).toBeDefined();
  });

  it("returns 400 when GGCC reajuste months is sent without pctReajuste", async () => {
    const payload = makePayload();
    payload.ggcc = [
      {
        ...(payload.ggcc[0] as unknown as Record<string, unknown>),
        mesesReajuste: 12,
        pctReajuste: null
      }
    ] as unknown as ContractFormPayload["ggcc"];

    const response = await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
      { id: "contract-1" }
    );

    expect(response.status).toBe(400);
    expect(prismaMock.contrato.findFirst).not.toHaveBeenCalled();
  });

  it("marks ggcc as modified when only pctReajuste changes", async () => {
    const existing = makeExistingContract();
    const payload = makePayload();
    payload.ggcc = [
      {
        ...(payload.ggcc[0] as unknown as Record<string, unknown>),
        pctReajuste: "5",
        mesesReajuste: 12
      }
    ] as unknown as ContractFormPayload["ggcc"];
    const existingAligned = {
      ...existing,
      tarifas: [existing.tarifas[0]],
      ggcc: [
        {
          ...existing.ggcc[0],
          pctReajuste: new Prisma.Decimal("4"),
          mesesReajuste: 12
        }
      ]
    };
    payload.anexo = { fecha: "2026-04-01", descripcion: "Cambio pct reajuste GGCC" };

    prismaMock.contrato.findFirst.mockResolvedValue(existingAligned);
    const tx = setupTransaction({
      existingTarifas: [existingAligned.tarifas[0]],
      existingGgcc: existingAligned.ggcc,
      finalContract: { id: "contract-1", tarifas: [existingAligned.tarifas[0]], ggcc: existingAligned.ggcc }
    });

    await callPut(
      new Request("http://localhost/api/contracts/contract-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
      { id: "contract-1" }
    );

    const anexoPayload = tx.contratoAnexo.create.mock.calls[0][0].data as { camposModificados: string[] };
    expect(anexoPayload.camposModificados).toContain("ggcc");
  });
});

describe("Scoped GET/DELETE /api/contracts/[id]", () => {
  it("GET returns 400 when proyectoId is missing", async () => {
    const response = await callGet(new Request("http://localhost/api/contracts/contract-1"), {
      id: "contract-1"
    });

    expect(response.status).toBe(400);
  });

  it("GET returns 404 when contract does not belong to proyectoId", async () => {
    prismaMock.contrato.findFirst.mockResolvedValue(null);

    const response = await callGet(
      new Request("http://localhost/api/contracts/contract-1?proyectoId=other-project"),
      { id: "contract-1" }
    );

    expect(response.status).toBe(404);
  });

  it("DELETE returns 400 when proyectoId is missing", async () => {
    const response = await callDelete(
      new Request("http://localhost/api/contracts/contract-1", { method: "DELETE" }),
      {
        id: "contract-1"
      }
    );

    expect(response.status).toBe(400);
  });

  it("DELETE returns 404 when nothing is deleted for the scoped project", async () => {
    prismaMock.contrato.deleteMany.mockResolvedValue({ count: 0 });

    const response = await callDelete(
      new Request("http://localhost/api/contracts/contract-1?proyectoId=other-project", {
        method: "DELETE"
      }),
      {
        id: "contract-1"
      }
    );

    expect(response.status).toBe(404);
  });
});
