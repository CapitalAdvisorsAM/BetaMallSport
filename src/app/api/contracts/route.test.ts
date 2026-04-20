import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, listContractsPageMock, prismaMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  listContractsPageMock: vi.fn(),
  prismaMock: {
    project: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock,
  requireWriteAccess: vi.fn()
}));

vi.mock("@/lib/contracts/contract-query-service", () => ({
  listContractsPage: listContractsPageMock,
  applyEstadoComputado: (contracts: unknown[]) => contracts
}));

vi.mock("@/lib/contracts/contract-command-service", () => ({
  createContractCommand: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

describe("GET /api/contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.project.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id
    }));
    listContractsPageMock.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false
    });
  });

  it("returns 400 when limit is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/contracts?projectId=p1")
    );

    expect(response.status).toBe(400);
    expect(listContractsPageMock).not.toHaveBeenCalled();
  });

  it("returns paginated payload when limit is provided", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/contracts?projectId=p1&limit=10")
    );

    expect(response.status).toBe(200);
    expect(listContractsPageMock).toHaveBeenCalledWith({
      projectId: "p1",
      limit: 10,
      cursor: undefined
    });
  });
});
