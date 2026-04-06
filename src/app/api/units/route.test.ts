import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, requireWriteAccessMock, listUnitsPageMock, createUnitMock } = vi.hoisted(
  () => ({
    requireSessionMock: vi.fn(),
    requireWriteAccessMock: vi.fn(),
    listUnitsPageMock: vi.fn(),
    createUnitMock: vi.fn()
  })
);

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock,
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/units/unit-service", () => ({
  listUnitsPage: listUnitsPageMock,
  createUnit: createUnitMock
}));

describe("GET /api/units", () => {
  beforeEach(() => {
    requireSessionMock.mockResolvedValue({ user: { id: "u1" } });
    listUnitsPageMock.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false
    });
  });

  it("returns 400 when limit is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/units?projectId=p1"));

    expect(response.status).toBe(400);
    expect(listUnitsPageMock).not.toHaveBeenCalled();
  });

  it("returns paginated payload when limit is provided", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/units?projectId=p1&limit=20"));

    expect(response.status).toBe(200);
    expect(listUnitsPageMock).toHaveBeenCalledWith({
      projectId: "p1",
      limit: 20,
      cursor: undefined
    });
  });
});

describe("POST /api/units", () => {
  beforeEach(() => {
    requireWriteAccessMock.mockResolvedValue({ user: { id: "u1" } });
    createUnitMock.mockResolvedValue({
      id: "unit-1",
      proyectoId: "p1",
      codigo: "L-101",
      nombre: "Local 101",
      glam2: "90",
      piso: "1",
      tipo: "LOCAL_COMERCIAL",
      zona: null,
      esGLA: true,
      estado: "ACTIVO"
    });
  });

  it("returns 400 for invalid payload", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/units", {
        method: "POST",
        body: JSON.stringify({ proyectoId: "p1" })
      })
    );

    expect(response.status).toBe(400);
    expect(createUnitMock).not.toHaveBeenCalled();
  });

  it("creates a unit with valid payload", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/units", {
        method: "POST",
        body: JSON.stringify({
          proyectoId: "p1",
          codigo: "L-101",
          nombre: "Local 101",
          glam2: "90",
          piso: "1",
          tipo: "LOCAL_COMERCIAL",
          zona: null,
          esGLA: true,
          estado: "ACTIVO"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(createUnitMock).toHaveBeenCalledTimes(1);
  });
});
