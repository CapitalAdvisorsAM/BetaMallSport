import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSessionMock,
  requireWriteAccessMock,
  listTenantsPageMock,
  createTenantMock,
  prismaMock
} = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  requireWriteAccessMock: vi.fn(),
  listTenantsPageMock: vi.fn(),
  createTenantMock: vi.fn(),
  prismaMock: {
    project: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock,
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/tenants/tenant-service", () => ({
  listTenantsPage: listTenantsPageMock,
  createTenant: createTenantMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

describe("GET /api/tenants", () => {
  beforeEach(() => {
    requireSessionMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.project.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id
    }));
    listTenantsPageMock.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false
    });
  });

  it("returns 400 when limit is missing", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/tenants?projectId=p1"));

    expect(response.status).toBe(400);
    expect(listTenantsPageMock).not.toHaveBeenCalled();
  });

  it("returns paginated payload when limit is provided", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/tenants?projectId=p1&limit=25"));

    expect(response.status).toBe(200);
    expect(listTenantsPageMock).toHaveBeenCalledWith({
      projectId: "p1",
      limit: 25,
      cursor: undefined
    });
  });
});

describe("POST /api/tenants", () => {
  beforeEach(() => {
    requireWriteAccessMock.mockResolvedValue({ user: { id: "u1" } });
    prismaMock.project.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id
    }));
    createTenantMock.mockResolvedValue({
      id: "t1",
      proyectoId: "p1",
      rut: "1-9",
      razonSocial: "Tenant SA",
      nombreComercial: "Tenant",
      vigente: true,
      email: null,
      telefono: null
    });
  });

  it("returns 400 for invalid payload", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenants?projectId=p1", {
        method: "POST",
        body: JSON.stringify({ proyectoId: "p1" })
      })
    );

    expect(response.status).toBe(400);
    expect(createTenantMock).not.toHaveBeenCalled();
  });

  it("creates a tenant with valid payload", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenants?projectId=p1", {
        method: "POST",
        body: JSON.stringify({
          proyectoId: "p1",
          rut: "1-9",
          razonSocial: "Tenant SA",
          nombreComercial: "Tenant",
          vigente: true,
          email: null,
          telefono: null
        })
      })
    );

    expect(response.status).toBe(201);
    expect(createTenantMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when request and payload project ids differ", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/tenants?projectId=p1", {
        method: "POST",
        body: JSON.stringify({
          proyectoId: "p2",
          rut: "1-9",
          razonSocial: "Tenant SA",
          nombreComercial: "Tenant",
          vigente: true,
          email: null,
          telefono: null
        })
      })
    );

    expect(response.status).toBe(400);
    expect(createTenantMock).not.toHaveBeenCalled();
  });
});
