import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { read } from "xlsx";
import { UnauthorizedError } from "@/lib/errors";

const { requireSessionMock, prismaMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  prismaMock: {
    proyecto: {
      findMany: vi.fn()
    },
    local: {
      findMany: vi.fn()
    },
    arrendatario: {
      findMany: vi.fn()
    },
    contrato: {
      findMany: vi.fn()
    },
    mapeoLocalContable: {
      findMany: vi.fn()
    },
    mapeoVentasLocal: {
      findMany: vi.fn()
    },
    registroContable: {
      findMany: vi.fn()
    },
    ventaLocal: {
      findMany: vi.fn()
    }
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

beforeEach(() => {
  vi.resetModules();
  requireSessionMock.mockResolvedValue({ user: { id: "u1" } });

  prismaMock.proyecto.findMany.mockResolvedValue([
    { nombre: "Mall Sport", slug: "mall-sport", color: "#0f766e", activo: true }
  ]);

  prismaMock.local.findMany.mockResolvedValue([
    {
      codigo: "L-101",
      nombre: "Local 101",
      tipo: "LOCAL_COMERCIAL",
      piso: "1",
      zona: "Outdoor",
      glam2: "120.5",
      esGLA: true,
      estado: "ACTIVO"
    }
  ]);

  prismaMock.contrato.findMany.mockResolvedValue([
    {
      numeroContrato: "C-100",
      estado: "VIGENTE",
      fechaInicio: new Date("2026-01-01"),
      fechaTermino: new Date("2026-12-31"),
      pdfUrl: "https://example.com/c-100.pdf",
      local: { codigo: "L-101", nombre: "Local 101" },
      locales: [],
      arrendatario: { nombreComercial: "Arrendatario Uno" },
      tarifas: [
        {
          tipo: "FIJO_UF_M2",
          valor: "12.5",
          vigenciaDesde: new Date("2026-01-01"),
          vigenciaHasta: null,
          esDiciembre: false
        }
      ],
      ggcc: [
        {
          tarifaBaseUfM2: "1.25",
          pctAdministracion: "8",
          pctReajuste: null,
          vigenciaDesde: new Date("2026-01-01"),
          vigenciaHasta: null,
          proximoReajuste: null,
          mesesReajuste: null
        }
      ]
    }
  ]);

  prismaMock.mapeoLocalContable.findMany.mockResolvedValue([
    { localExterno: "102", local: { codigo: "L-102", nombre: "Local 102" } }
  ]);
  prismaMock.mapeoVentasLocal.findMany.mockResolvedValue([
    { idCa: 217, tiendaNombre: "Tienda X", local: { codigo: "L-217", nombre: "Local 217" } }
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/export/excel", () => {
  it("requires authenticated session", async () => {
    requireSessionMock.mockRejectedValueOnce(new UnauthorizedError());

    const response = await callGet("http://localhost/api/export/excel?dataset=proyectos&scope=all");
    const payload = (await response.json()) as { message: string };

    expect(response.status).toBe(401);
    expect(payload.message).toBe("No autorizado.");
  });

  it("validates dataset and scope params", async () => {
    const invalidDataset = await callGet("http://localhost/api/export/excel?dataset=foo&scope=all");
    const invalidScope = await callGet("http://localhost/api/export/excel?dataset=proyectos&scope=foo");

    expect(invalidDataset.status).toBe(400);
    expect(invalidScope.status).toBe(400);
  });

  it("returns download headers for projects", async () => {
    const response = await callGet("http://localhost/api/export/excel?dataset=proyectos&scope=all");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("content-disposition")).toContain("attachment; filename=\"proyectos-all-");
  });

  it("applies filtered locales query params", async () => {
    const response = await callGet(
      "http://localhost/api/export/excel?dataset=locales&scope=filtered&proyectoId=p1&q=l-10&estado=ACTIVO"
    );

    expect(response.status).toBe(200);
    expect(prismaMock.local.findMany).toHaveBeenCalledTimes(1);

    const args = prismaMock.local.findMany.mock.calls[0]?.[0] as {
      where: { proyectoId: string; estado: string; OR: Array<Record<string, unknown>> };
    };
    expect(args.where.proyectoId).toBe("p1");
    expect(args.where.estado).toBe("ACTIVO");
    expect(args.where.OR).toHaveLength(2);
  });

  it("exports contratos as three sheets and mapeos filtered/all with expected sheet count", async () => {
    const contratosResponse = await callGet(
      "http://localhost/api/export/excel?dataset=contratos&scope=all&proyectoId=p1"
    );
    const contratosWorkbook = read(Buffer.from(await contratosResponse.arrayBuffer()), { type: "buffer" });
    expect(contratosWorkbook.SheetNames).toEqual(["Resumen", "Tarifas", "GGCC"]);

    const mapeosFilteredResponse = await callGet(
      "http://localhost/api/export/excel?dataset=finanzas_mapeos&scope=filtered&proyectoId=p1&tab=contable"
    );
    const mapeosFilteredWorkbook = read(Buffer.from(await mapeosFilteredResponse.arrayBuffer()), {
      type: "buffer"
    });
    expect(mapeosFilteredWorkbook.SheetNames).toEqual(["Mapeo Contable"]);

    const mapeosAllResponse = await callGet(
      "http://localhost/api/export/excel?dataset=finanzas_mapeos&scope=all&proyectoId=p1"
    );
    const mapeosAllWorkbook = read(Buffer.from(await mapeosAllResponse.arrayBuffer()), {
      type: "buffer"
    });
    expect(mapeosAllWorkbook.SheetNames).toEqual(["Mapeo Contable", "Mapeo Ventas"]);
  });
});
