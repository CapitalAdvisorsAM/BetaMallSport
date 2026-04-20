import { describe, expect, it } from "vitest";
import { contractPayloadSchema } from "./schema";

type ContractPayload = (typeof contractPayloadSchema)["_type"];

function basePayload(): ContractPayload {
  return {
    proyectoId: "p1",
    localId: "l1",
    localIds: ["l1"],
    arrendatarioId: "a1",
    numeroContrato: "C-001",
    fechaInicio: "2026-01-01",
    fechaTermino: "2028-12-31",
    fechaEntrega: null,
    fechaApertura: null,
    diasGracia: 0,
    rentaVariable: [],
    pctFondoPromocion: null,
    pctAdministracionGgcc: null,
    multiplicadorDiciembre: null,
    multiplicadorJunio: null,
    multiplicadorJulio: null,
    multiplicadorAgosto: null,
    codigoCC: null,
    pdfUrl: null,
    notas: null,
    tarifas: [
      {
        tipo: "FIJO_UF_M2",
        valor: "1.0",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: "2028-12-31",
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null
      }
    ],
    ggcc: [],
    anexo: null
  };
}

function issueMessages(result: { success: boolean; error?: { issues: Array<{ message: string }> } }): string[] {
  return result.error?.issues.map((i) => i.message) ?? [];
}

describe("contractPayloadSchema — tarifa vigencia dentro del rango del contrato", () => {
  it("rechaza tarifa con vigenciaDesde anterior a fechaInicio del contrato", () => {
    const payload = basePayload();
    payload.tarifas[0].vigenciaDesde = "2025-06-01";
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain(
      "vigenciaDesde de la tarifa no puede ser anterior a fechaInicio del contrato."
    );
  });

  it("rechaza tarifa con vigenciaHasta posterior a fechaTermino del contrato", () => {
    const payload = basePayload();
    payload.tarifas[0].vigenciaHasta = "2030-01-01";
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain(
      "vigenciaHasta de la tarifa no puede ser posterior a fechaTermino del contrato."
    );
  });

  it("acepta tarifa con vigencia dentro del rango del contrato", () => {
    const payload = basePayload();
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("acepta tarifa con vigenciaHasta null (abierta) dentro del contrato", () => {
    const payload = basePayload();
    payload.tarifas[0].vigenciaHasta = null;
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe("contractPayloadSchema — overlap de vigencias de tarifas", () => {
  it("rechaza dos tarifas del mismo tipo con vigencias solapadas", () => {
    const payload = basePayload();
    payload.tarifas = [
      {
        tipo: "FIJO_UF_M2",
        valor: "1.0",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: "2026-12-31",
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null
      },
      {
        tipo: "FIJO_UF_M2",
        valor: "1.2",
        vigenciaDesde: "2026-06-01",
        vigenciaHasta: "2027-06-01",
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null
      }
    ];
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain(
      "Hay tarifas con vigencias solapadas del mismo tipo."
    );
  });

  it("acepta tramos consecutivos sin overlap", () => {
    const payload = basePayload();
    payload.tarifas = [
      {
        tipo: "FIJO_UF_M2",
        valor: "1.0",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: "2026-12-31",
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null
      },
      {
        tipo: "FIJO_UF_M2",
        valor: "1.2",
        vigenciaDesde: "2027-01-01",
        vigenciaHasta: "2028-12-31",
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null
      }
    ];
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("no detecta overlap cuando los tipos difieren", () => {
    const payload = basePayload();
    payload.rentaVariable = [
      {
        pctRentaVariable: "5",
        umbralVentasUf: "0",
        pisoMinimoUf: null,
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: "2028-12-31"
      }
    ];
    payload.tarifas = [
      {
        tipo: "FIJO_UF_M2",
        valor: "1.0",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: "2028-12-31",
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null
      },
      {
        tipo: "FIJO_UF",
        valor: "50",
        vigenciaDesde: "2026-01-01",
        vigenciaHasta: "2028-12-31",
        esDiciembre: false,
        descuentoTipo: null,
        descuentoValor: null,
        descuentoDesde: null,
        descuentoHasta: null
      }
    ];
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe("contractPayloadSchema — GGCC reajuste", () => {
  it("rechaza GGCC con mesesReajuste pero sin pctReajuste", () => {
    const payload = basePayload();
    payload.ggcc = [
      {
        tarifaBaseUfM2: "0.5",
        pctAdministracion: "10",
        pctReajuste: null,
        proximoReajuste: "2027-01-01",
        mesesReajuste: 12
      }
    ];
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain(
      "pctReajuste es obligatorio cuando GGCC tiene mesesReajuste."
    );
  });

  it("rechaza GGCC con mesesReajuste pero sin proximoReajuste", () => {
    const payload = basePayload();
    payload.ggcc = [
      {
        tarifaBaseUfM2: "0.5",
        pctAdministracion: "10",
        pctReajuste: "3",
        proximoReajuste: null,
        mesesReajuste: 12
      }
    ];
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain(
      "proximoReajuste es obligatorio cuando GGCC tiene mesesReajuste."
    );
  });

  it("acepta GGCC sin reajuste configurado", () => {
    const payload = basePayload();
    payload.ggcc = [
      {
        tarifaBaseUfM2: "0.5",
        pctAdministracion: "10",
        pctReajuste: null,
        proximoReajuste: null,
        mesesReajuste: null
      }
    ];
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("acepta GGCC con reajuste completo", () => {
    const payload = basePayload();
    payload.ggcc = [
      {
        tarifaBaseUfM2: "0.5",
        pctAdministracion: "10",
        pctReajuste: "3",
        proximoReajuste: "2027-01-01",
        mesesReajuste: 12
      }
    ];
    const result = contractPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
