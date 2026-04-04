import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, listContractsPageMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  listContractsPageMock: vi.fn()
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock,
  requireWriteAccess: vi.fn()
}));

vi.mock("@/lib/contracts/contract-query-service", () => ({
  listContractsPage: listContractsPageMock
}));

vi.mock("@/lib/contracts/contract-command-service", () => ({
  createContractCommand: vi.fn()
}));

describe("GET /api/contracts", () => {
  beforeEach(() => {
    requireSessionMock.mockResolvedValue({ user: { id: "u1" } });
    listContractsPageMock.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false
    });
  });

  it("returns 400 when limit is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/contracts?proyectoId=p1")
    );

    expect(response.status).toBe(400);
    expect(listContractsPageMock).not.toHaveBeenCalled();
  });

  it("returns paginated payload when limit is provided", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/contracts?proyectoId=p1&limit=10")
    );

    expect(response.status).toBe(200);
    expect(listContractsPageMock).toHaveBeenCalledWith({
      proyectoId: "p1",
      limit: 10,
      cursor: undefined
    });
  });
});
