import { describe, expect, it, vi } from "vitest";

const { unitsGetMock, unitsPostMock } = vi.hoisted(() => ({
  unitsGetMock: vi.fn(),
  unitsPostMock: vi.fn()
}));

vi.mock("@/app/api/units/route", () => ({
  GET: unitsGetMock,
  POST: unitsPostMock
}));

describe("legacy locales route", () => {
  it("adds deprecation headers on GET", async () => {
    unitsGetMock.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/locales?projectId=p1&limit=10"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("X-Canonical-Endpoint")).toBe("/api/units");
  });

  it("adds deprecation headers on POST", async () => {
    unitsPostMock.mockResolvedValue(new Response(JSON.stringify({ id: "u1" }), { status: 201 }));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/locales", { method: "POST" }));

    expect(response.status).toBe(201);
    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("X-Canonical-Endpoint")).toBe("/api/units");
  });
});
