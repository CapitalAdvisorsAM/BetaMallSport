import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, prismaMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  prismaMock: {
    accountingRecord: { findMany: vi.fn() }
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
  return GET(new Request(url) as never);
}

describe("GET /api/real/expenses/detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
    prismaMock.accountingRecord.findMany.mockResolvedValue([]);
  });

  it("returns 400 when projectId is missing", async () => {
    const response = await callGet(
      "http://localhost/api/real/expenses/detail?grupo1=GASTOS%20MARKETING&grupo3=Publicidad"
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when grupo1 is missing", async () => {
    const response = await callGet(
      "http://localhost/api/real/expenses/detail?projectId=p1&grupo3=Publicidad"
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when grupo3 is missing", async () => {
    const response = await callGet(
      "http://localhost/api/real/expenses/detail?projectId=p1&grupo1=GASTOS%20MARKETING"
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when grupo1 is not an operating expense group", async () => {
    const response = await callGet(
      "http://localhost/api/real/expenses/detail?projectId=p1&grupo1=INGRESOS%20DE%20EXPLOTACION&grupo3=ARRIENDO"
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 when session is missing", async () => {
    const { UnauthorizedError } = await import("@/lib/errors");
    requireSessionMock.mockRejectedValueOnce(new UnauthorizedError());
    const response = await callGet(
      "http://localhost/api/real/expenses/detail?projectId=p1&grupo1=GASTOS%20MARKETING&grupo3=Publicidad"
    );
    expect(response.status).toBe(401);
  });

  it("returns 200 with empty rows when no records match", async () => {
    prismaMock.accountingRecord.findMany.mockResolvedValueOnce([]);
    const response = await callGet(
      "http://localhost/api/real/expenses/detail?projectId=p1&grupo1=GASTOS%20MARKETING&grupo3=Publicidad&from=2026-01&to=2026-03"
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { rows: unknown[]; total: number };
    expect(body.rows).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns 200 with serialized rows including unit and tenant", async () => {
    prismaMock.accountingRecord.findMany.mockResolvedValueOnce([
      {
        id: "rec-1",
        period: new Date("2026-02-01T00:00:00Z"),
        denomination: "Campaña digital",
        costCenterCode: "CC-100",
        valueUf: "150.5000",
        unit: { codigo: "L-12", nombre: "Local 12" },
        tenant: { nombreComercial: "Tenant SA" }
      },
      {
        id: "rec-2",
        period: new Date("2026-01-01T00:00:00Z"),
        denomination: "Folletería",
        costCenterCode: null,
        valueUf: "75.2500",
        unit: null,
        tenant: null
      }
    ]);

    const response = await callGet(
      "http://localhost/api/real/expenses/detail?projectId=p1&grupo1=GASTOS%20MARKETING&grupo3=Publicidad&from=2026-01&to=2026-03"
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      rows: Array<{
        id: string;
        period: string;
        denomination: string;
        costCenterCode: string | null;
        unit: { code: string; name: string } | null;
        tenant: { tradeName: string } | null;
        valueUf: number;
      }>;
      total: number;
    };

    expect(body.rows).toHaveLength(2);
    expect(body.rows[0]).toEqual({
      id: "rec-1",
      period: "2026-02-01",
      denomination: "Campaña digital",
      costCenterCode: "CC-100",
      unit: { code: "L-12", name: "Local 12" },
      tenant: { tradeName: "Tenant SA" },
      valueUf: 150.5
    });
    expect(body.rows[1].unit).toBeNull();
    expect(body.rows[1].tenant).toBeNull();
    expect(body.total).toBeCloseTo(225.75, 4);
  });
});
