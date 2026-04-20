import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWriteAccessMock, prismaMock } = vi.hoisted(() => ({
  requireWriteAccessMock: vi.fn(),
  prismaMock: {
    project: { findFirst: vi.fn() },
    tenant: { findFirst: vi.fn() },
    tenantBudgetedSale: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/permissions", () => ({
  requireWriteAccess: requireWriteAccessMock,
  requireSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

async function callPut(body: unknown, projectId = "p1"): Promise<Response> {
  const { PUT } = await import("./route");
  return PUT(
    new Request(`http://localhost/api/rent-roll/budgeted-sales?projectId=${projectId}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("PUT /api/rent-roll/budgeted-sales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWriteAccessMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.project.findFirst.mockResolvedValue({ id: "p1" });
    prismaMock.tenant.findFirst.mockResolvedValue({ id: "t1" });
  });

  it("returns 400 when period is invalid", async () => {
    const response = await callPut({
      projectId: "p1",
      tenantId: "t1",
      period: "2026/01",
      salesPesos: "100",
    });
    expect(response.status).toBe(400);
    expect(prismaMock.tenantBudgetedSale.upsert).not.toHaveBeenCalled();
  });

  it("returns 403 when user cannot write", async () => {
    requireWriteAccessMock.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { name: "ForbiddenError" }),
    );
    const response = await callPut({
      projectId: "p1",
      tenantId: "t1",
      period: "2026-01",
      salesPesos: "100",
    });
    expect(response.status).toBe(403);
  });

  it("returns 404 when tenant does not belong to project", async () => {
    prismaMock.tenant.findFirst.mockResolvedValue(null);
    const response = await callPut({
      projectId: "p1",
      tenantId: "t-other",
      period: "2026-01",
      salesPesos: "100",
    });
    expect(response.status).toBe(404);
    expect(prismaMock.tenantBudgetedSale.upsert).not.toHaveBeenCalled();
  });

  it("upserts the cell when salesPesos is provided", async () => {
    prismaMock.tenantBudgetedSale.upsert.mockResolvedValue({
      tenantId: "t1",
      period: new Date(Date.UTC(2026, 0, 1)),
      salesPesos: new Prisma.Decimal("1234.5"),
    });
    const response = await callPut({
      projectId: "p1",
      tenantId: "t1",
      period: "2026-01",
      salesPesos: "1234.5",
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { tenantId: string; period: string; salesPesos: string };
    expect(body.period).toBe("2026-01");
    expect(body.salesPesos).toBe("1234.5");
    expect(prismaMock.tenantBudgetedSale.upsert).toHaveBeenCalledTimes(1);
  });

  it("deletes the cell when salesPesos is null", async () => {
    prismaMock.tenantBudgetedSale.deleteMany.mockResolvedValue({ count: 1 });
    const response = await callPut({
      projectId: "p1",
      tenantId: "t1",
      period: "2026-01",
      salesPesos: null,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { salesPesos: string | null };
    expect(body.salesPesos).toBeNull();
    expect(prismaMock.tenantBudgetedSale.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.tenantBudgetedSale.upsert).not.toHaveBeenCalled();
  });

  it("rejects negative salesPesos", async () => {
    const response = await callPut({
      projectId: "p1",
      tenantId: "t1",
      period: "2026-01",
      salesPesos: "-5",
    });
    expect(response.status).toBe(400);
    expect(prismaMock.tenantBudgetedSale.upsert).not.toHaveBeenCalled();
  });
});
