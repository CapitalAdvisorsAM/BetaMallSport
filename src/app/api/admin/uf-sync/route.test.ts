import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, prismaMock, fetchUfValueMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  prismaMock: {
    valorUF: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
  fetchUfValueMock: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock,
  requireWriteAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/uf-sync/cmf-client", () => ({
  fetchUfValue: fetchUfValueMock,
}));

vi.mock("@/lib/observability", () => ({
  logInfo: vi.fn(),
  logDuration: vi.fn(),
  logError: vi.fn(),
}));

async function callPost(init: { body?: unknown; headers?: Record<string, string> } = {}) {
  const { POST } = await import("./route");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  const request = new Request("http://localhost/api/admin/uf-sync", {
    method: "POST",
    headers,
    body: init.body === undefined ? "{}" : JSON.stringify(init.body),
  });
  return POST(request);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makeRange(days: number): Date[] {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const out: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d);
  }
  return out;
}

describe("POST /api/admin/uf-sync", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    requireSessionMock.mockRejectedValue(new Error("no session"));
    prismaMock.valorUF.findMany.mockReset();
    prismaMock.valorUF.upsert.mockReset();
    fetchUfValueMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 401 when X-Cron-Secret is missing and no session", async () => {
    const response = await callPost();
    expect(response.status).toBe(401);
    expect(fetchUfValueMock).not.toHaveBeenCalled();
  });

  it("returns 401 when X-Cron-Secret is wrong", async () => {
    const response = await callPost({ headers: { "X-Cron-Secret": "nope" } });
    expect(response.status).toBe(401);
  });

  it("accepts a valid X-Cron-Secret without a session", async () => {
    prismaMock.valorUF.findMany.mockResolvedValue(
      makeRange(7).map((fecha) => ({ fecha }))
    );

    const response = await callPost({ headers: { "X-Cron-Secret": "test-secret" } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.upToDate).toBe(true);
    expect(body.mode).toBe("catchup");
    expect(fetchUfValueMock).not.toHaveBeenCalled();
  });

  it("catch-up default: skips CMF when last 7 days are all present", async () => {
    prismaMock.valorUF.findMany.mockResolvedValue(
      makeRange(7).map((fecha) => ({ fecha }))
    );

    const response = await callPost({
      headers: { "X-Cron-Secret": "test-secret" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      synced: 0,
      skipped: 0,
      records: [],
      upToDate: true,
      mode: "catchup",
    });
    expect(fetchUfValueMock).not.toHaveBeenCalled();
    expect(prismaMock.valorUF.upsert).not.toHaveBeenCalled();
  });

  it("catch-up default: fetches only the missing dates from CMF", async () => {
    const range = makeRange(7);
    // DB has all days except the first and last of the 7-day window.
    const existing = range.slice(1, 6).map((fecha) => ({ fecha }));
    prismaMock.valorUF.findMany.mockResolvedValue(existing);

    fetchUfValueMock.mockImplementation(async (date: Date) => ({
      fecha: date,
      valor: new Prisma.Decimal("38153.56"),
    }));
    prismaMock.valorUF.upsert.mockResolvedValue({});

    const response = await callPost({
      headers: { "X-Cron-Secret": "test-secret" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.synced).toBe(2);
    expect(body.skipped).toBe(0);
    expect(body.mode).toBe("catchup");
    expect(fetchUfValueMock).toHaveBeenCalledTimes(2);
    expect(prismaMock.valorUF.upsert).toHaveBeenCalledTimes(2);

    const fetchedDates = (fetchUfValueMock.mock.calls as [Date][])
      .map(([d]) => isoDate(d))
      .sort();
    expect(fetchedDates).toEqual([isoDate(range[0]!), isoDate(range[6]!)].sort());
  });

  it("catch-up increments 'skipped' when CMF has no value for a date", async () => {
    const range = makeRange(7);
    prismaMock.valorUF.findMany.mockResolvedValue(
      range.slice(0, 6).map((fecha) => ({ fecha }))
    );
    fetchUfValueMock.mockResolvedValue(null);

    const response = await callPost({
      headers: { "X-Cron-Secret": "test-secret" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.synced).toBe(0);
    expect(body.skipped).toBe(1);
    expect(prismaMock.valorUF.upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid 'dias' parameter", async () => {
    const response = await callPost({
      headers: { "X-Cron-Secret": "test-secret" },
      body: { modo: "catchup", dias: 0 },
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toMatch(/dias/);
  });

  it("rejects 'dias' above the 30-day cap", async () => {
    const response = await callPost({
      headers: { "X-Cron-Secret": "test-secret" },
      body: { modo: "catchup", dias: 31 },
    });
    expect(response.status).toBe(400);
  });

  it("modo=hoy falls back to legacy single-day behaviour", async () => {
    fetchUfValueMock.mockResolvedValue({
      fecha: new Date(new Date().toISOString().slice(0, 10)),
      valor: new Prisma.Decimal("38153.56"),
    });
    prismaMock.valorUF.upsert.mockResolvedValue({});

    const response = await callPost({
      headers: { "X-Cron-Secret": "test-secret" },
      body: { modo: "hoy" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("hoy");
    expect(body.synced).toBe(1);
    expect(fetchUfValueMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.valorUF.findMany).not.toHaveBeenCalled();
  });
});
