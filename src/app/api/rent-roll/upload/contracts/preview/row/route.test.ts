import { DataUploadType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWriteAccessMock, prismaMock } = vi.hoisted(() => ({
  requireWriteAccessMock: vi.fn(),
  prismaMock: {
    dataUpload: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    unit: {
      findMany: vi.fn()
    },
    tenant: {
      findMany: vi.fn()
    },
    contract: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/lib/permissions", () => ({
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

async function callPatch(body: Record<string, unknown>) {
  const { PATCH } = await import("./route");
  return PATCH(
    new Request("http://localhost/api/rent-roll/upload/contracts/preview/row", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

function makeStoredPreview() {
  return {
    rows: [
      {
        rowNumber: 2,
        status: "NEW",
        data: {
          numeroContrato: "",
          localCodigo: "L-101",
          arrendatarioNombre: "ACME SPORT",
          estado: "VIGENTE",
          fechaInicio: "2026-01-01",
          fechaTermino: "2026-12-31",
          fechaEntrega: null,
          fechaApertura: null,
          tarifaTipo: "FIJO_UF_M2",
          tarifaValor: "3.5",
          tarifaVigenciaDesde: "2026-01-01",
          tarifaVigenciaHasta: null,
          pctFondoPromocion: null,
          multiplicadorDiciembre: null,
          multiplicadorJunio: null,
          multiplicadorJulio: null,
          multiplicadorAgosto: null,
          codigoCC: null,
          ggccPctAdministracion: null,
          ggccPctReajuste: null,
          notas: null,
          ggccTipo: null,
          ggccValor: null,
          ggccMesesReajuste: null,
          anexoFecha: null,
          anexoDescripcion: null
        }
      }
    ],
    summary: {
      total: 1,
      nuevo: 1,
      actualizado: 0,
      sinCambio: 0,
      errores: 0
    },
    warnings: []
  };
}

beforeEach(() => {
  requireWriteAccessMock.mockResolvedValue({ user: { id: "u1" } });
  prismaMock.dataUpload.findUnique.mockReset();
  prismaMock.dataUpload.update.mockReset();
  prismaMock.unit.findMany.mockReset();
  prismaMock.tenant.findMany.mockReset();
  prismaMock.contract.findMany.mockReset();
});

describe("PATCH /api/rent-roll/upload/contracts/preview/row", () => {
  it("returns 400 when rowNumber is invalid", async () => {
    const response = await callPatch({
      cargaId: "c1",
      rowNumber: "x",
      data: {}
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 when carga does not exist", async () => {
    prismaMock.dataUpload.findUnique.mockResolvedValue(null);
    const response = await callPatch({
      cargaId: "c1",
      rowNumber: 2,
      data: {}
    });
    expect(response.status).toBe(404);
  });

  it("returns 404 when row is not present in preview", async () => {
    prismaMock.dataUpload.findUnique.mockResolvedValue({
      id: "c1",
      type: DataUploadType.RENT_ROLL,
      status: "PENDING",
      projectId: "p1",
      fileName: "plantilla.xlsx",
      errorDetail: JSON.stringify(makeStoredPreview())
    });
    const response = await callPatch({
      cargaId: "c1",
      rowNumber: 999,
      data: {}
    });
    expect(response.status).toBe(404);
  });

  it("persists and returns updated preview for a valid edited row", async () => {
    prismaMock.dataUpload.findUnique.mockResolvedValue({
      id: "c1",
      type: DataUploadType.RENT_ROLL,
      status: "PENDING",
      projectId: "p1",
      fileName: "plantilla.xlsx",
      errorDetail: JSON.stringify(makeStoredPreview())
    });
    prismaMock.unit.findMany.mockResolvedValue([{ codigo: "L-101", glam2: { toString: () => "100" } }]);
    prismaMock.tenant.findMany.mockResolvedValue([{ nombreComercial: "ACME SPORT" }]);
    prismaMock.contract.findMany.mockResolvedValue([]);
    prismaMock.dataUpload.update.mockResolvedValue({});

    const response = await callPatch({
      cargaId: "c1",
      rowNumber: 2,
      data: {
        ...makeStoredPreview().rows[0].data,
        tarifaValor: "4.1"
      }
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { cargaId: string; preview: { rows: Array<{ data: { tarifaValor: string } }> } };
    expect(payload.cargaId).toBe("c1");
    expect(payload.preview.rows[0]?.data.tarifaValor).toBe("4.1");

    expect(prismaMock.dataUpload.update).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.dataUpload.update.mock.calls[0][0];
    expect(updateArgs.where.id).toBe("c1");
    expect(typeof updateArgs.data.errorDetail).toBe("string");
  });
});

