import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, prismaMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  prismaMock: {
    tenantSale: { findMany: vi.fn() },
    unit: { findMany: vi.fn() },
    contract: { findMany: vi.fn() },
    tenant: { findMany: vi.fn() },
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

describe("GET /api/real/sales-analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.tenantSale.findMany.mockResolvedValue([]);
    prismaMock.unit.findMany.mockResolvedValue([]);
    prismaMock.contract.findMany.mockResolvedValue([]);
    prismaMock.tenant.findMany.mockResolvedValue([]);
    prismaMock.valorUF.findMany.mockResolvedValue([]);
  });

  it("returns 400 when projectId is missing", async () => {
    const response = await callGet("http://localhost/api/real/sales-analytics");
    expect(response.status).toBe(400);
  });

  it("defaults to mode=timeseries", async () => {
    const response = await callGet("http://localhost/api/real/sales-analytics?projectId=p1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode: string };
    expect(body.mode).toBe("timeseries");
  });

  it("dispatches mode=kpis", async () => {
    const response = await callGet(
      "http://localhost/api/real/sales-analytics?projectId=p1&mode=kpis&from=2025-01&to=2025-03"
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode: string };
    expect(body.mode).toBe("kpis");
  });

  it("dispatches mode=crosstab", async () => {
    const response = await callGet(
      "http://localhost/api/real/sales-analytics?projectId=p1&mode=crosstab&rowDim=tamano&colDim=piso&from=2025-01&to=2025-01"
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode: string };
    expect(body.mode).toBe("crosstab");
  });

  it("invalid mode falls back to timeseries", async () => {
    const response = await callGet(
      "http://localhost/api/real/sales-analytics?projectId=p1&mode=garbage"
    );
    const body = (await response.json()) as { mode: string };
    expect(body.mode).toBe("timeseries");
  });

  it("returns 401 when requireSession throws UnauthorizedError", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    requireSessionMock.mockRejectedValueOnce(new UnauthorizedError());
    const response = await callGet("http://localhost/api/real/sales-analytics?projectId=p1");
    expect(response.status).toBe(401);
  });
});
