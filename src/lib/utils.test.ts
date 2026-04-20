import { ContractStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeEstadoContrato, isUfStale, startOfDay } from "@/lib/utils";

const fechaInicio = startOfDay(new Date("2026-06-01T00:00:00.000Z"));
const fechaTermino = startOfDay(new Date("2028-05-31T00:00:00.000Z"));

describe("computeEstadoContrato", () => {
  it("returns NO_INICIADO when today is before fechaInicio, regardless of diasGracia", () => {
    const today = startOfDay(new Date("2026-04-20T00:00:00.000Z"));

    expect(
      computeEstadoContrato(fechaInicio, fechaTermino, 0, ContractStatus.VIGENTE, today)
    ).toBe(ContractStatus.NO_INICIADO);

    expect(
      computeEstadoContrato(fechaInicio, fechaTermino, 30, ContractStatus.GRACIA, today)
    ).toBe(ContractStatus.NO_INICIADO);
  });

  it("returns GRACIA when today is on or after fechaInicio but before end of grace", () => {
    const today = startOfDay(new Date("2026-06-10T00:00:00.000Z"));

    expect(
      computeEstadoContrato(fechaInicio, fechaTermino, 30, ContractStatus.VIGENTE, today)
    ).toBe(ContractStatus.GRACIA);
  });

  it("returns VIGENTE when today equals fechaInicio and diasGracia is zero", () => {
    const today = startOfDay(fechaInicio);

    expect(
      computeEstadoContrato(fechaInicio, fechaTermino, 0, ContractStatus.VIGENTE, today)
    ).toBe(ContractStatus.VIGENTE);
  });

  it("returns VIGENTE when today is after grace period but before fechaTermino", () => {
    const today = startOfDay(new Date("2027-01-15T00:00:00.000Z"));

    expect(
      computeEstadoContrato(fechaInicio, fechaTermino, 30, ContractStatus.VIGENTE, today)
    ).toBe(ContractStatus.VIGENTE);
  });

  it("returns TERMINADO when today is past fechaTermino", () => {
    const today = startOfDay(new Date("2028-12-01T00:00:00.000Z"));

    expect(
      computeEstadoContrato(fechaInicio, fechaTermino, 0, ContractStatus.VIGENTE, today)
    ).toBe(ContractStatus.TERMINADO);
  });

  it("respects TERMINADO_ANTICIPADO manual override over any date-based rule", () => {
    const today = startOfDay(new Date("2026-04-20T00:00:00.000Z"));

    expect(
      computeEstadoContrato(fechaInicio, fechaTermino, 0, ContractStatus.TERMINADO_ANTICIPADO, today)
    ).toBe(ContractStatus.TERMINADO_ANTICIPADO);
  });
});

describe("isUfStale", () => {
  const today = startOfDay(new Date("2026-04-20T00:00:00.000Z"));

  it("returns true when fecha is null", () => {
    expect(isUfStale(null, today)).toBe(true);
  });

  it("returns false when fecha is 3 days old (within UF_STALENESS_DAYS)", () => {
    const fecha = startOfDay(new Date("2026-04-17T00:00:00.000Z"));
    expect(isUfStale(fecha, today)).toBe(false);
  });

  it("returns false when fecha is exactly UF_STALENESS_DAYS old (boundary)", () => {
    const fecha = startOfDay(new Date("2026-04-15T00:00:00.000Z"));
    expect(isUfStale(fecha, today)).toBe(false);
  });

  it("returns true when fecha is older than UF_STALENESS_DAYS", () => {
    const fecha = startOfDay(new Date("2026-04-14T00:00:00.000Z"));
    expect(isUfStale(fecha, today)).toBe(true);
  });
});
