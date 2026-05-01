import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, prismaMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  prismaMock: {
    tenant: { findMany: vi.fn() },
    tenantSale: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    unit: { findMany: vi.fn() },
    accountingRecord: { findMany: vi.fn() },
    valorUF: { findMany: vi.fn() }
  }
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

async function callGet(url: string): Promise<Response> {
  const { GET } = await import("./route");
  return GET(new Request(url));
}

describe("GET /api/real/sales-top-tenants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.tenant.findMany.mockResolvedValue([]);
    prismaMock.tenantSale.findMany.mockResolvedValue([]);
    prismaMock.contract.findMany.mockResolvedValue([]);
    prismaMock.unit.findMany.mockResolvedValue([]);
    prismaMock.accountingRecord.findMany.mockResolvedValue([]);
    prismaMock.valorUF.findMany.mockResolvedValue([]);
  });

  it("returns 400 when projectId is missing", async () => {
    const response = await callGet("http://localhost/api/real/sales-top-tenants");
    expect(response.status).toBe(400);
  });

  it("returns empty rows when no tenants exist", async () => {
    const response = await callGet(
      "http://localhost/api/real/sales-top-tenants?projectId=p1&from=2025-01&to=2025-03"
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });

  it("returns 401 when requireSession throws UnauthorizedError", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    requireSessionMock.mockRejectedValueOnce(new UnauthorizedError());
    const response = await callGet(
      "http://localhost/api/real/sales-top-tenants?projectId=p1"
    );
    expect(response.status).toBe(401);
  });
});
