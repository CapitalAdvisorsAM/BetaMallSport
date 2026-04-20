import type { Prisma } from "@prisma/client";
import { ContractStatus } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertNoOverlappingContracts } from "@/lib/contracts/persistence";
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
  proyectoId: "p1",
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
