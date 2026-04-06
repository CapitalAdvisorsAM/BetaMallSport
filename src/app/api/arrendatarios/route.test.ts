import { describe, expect, it, vi } from "vitest";

const { tenantsGetMock, tenantsPostMock } = vi.hoisted(() => ({
  tenantsGetMock: vi.fn(),
  tenantsPostMock: vi.fn()
}));

vi.mock("@/app/api/tenants/route", () => ({
  GET: tenantsGetMock,
  POST: tenantsPostMock
}));

describe("legacy arrendatarios route", () => {
  it("adds deprecation headers on GET", async () => {
    tenantsGetMock.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/arrendatarios?projectId=p1&limit=10")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("X-Canonical-Endpoint")).toBe("/api/tenants");
  });

  it("adds deprecation headers on POST", async () => {
    tenantsPostMock.mockResolvedValue(new Response(JSON.stringify({ id: "t1" }), { status: 201 }));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/arrendatarios", { method: "POST" })
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("X-Canonical-Endpoint")).toBe("/api/tenants");
  });
});
