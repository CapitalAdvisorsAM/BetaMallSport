import { describe, expect, it } from "vitest";
import { buildTenantFinanceRows } from "@/lib/finanzas/arrendatarios";

describe("buildTenantFinanceRows", () => {
  it("aggregates billing and sales across multiple locales and periods", () => {
    const rows = buildTenantFinanceRows(
      [
        {
          id: "tenant-1",
          rut: "11-1",
          razonSocial: "Acme Limitada",
          nombreComercial: "Acme",
          contratos: [
            {
              localId: "local-1",
              local: { id: "local-1", codigo: "L1", nombre: "Local 1" }
            },
            {
              localId: "local-2",
              local: { id: "local-2", codigo: "L2", nombre: "Local 2" }
            }
          ]
        }
      ],
      [
        {
          localId: "local-1",
          periodo: new Date("2026-01-01T00:00:00.000Z"),
          valorUf: 100
        },
        {
          localId: "local-2",
          periodo: new Date("2026-01-01T00:00:00.000Z"),
          valorUf: 50
        },
        {
          localId: "local-1",
          periodo: new Date("2026-02-01T00:00:00.000Z"),
          valorUf: 30
        }
      ],
      [
        {
          localId: "local-1",
          periodo: "2026-01",
          ventasUf: 1000
        },
        {
          localId: "local-2",
          periodo: "2026-01",
          ventasUf: 500
        },
        {
          localId: "local-1",
          periodo: "2026-02",
          ventasUf: 200
        }
      ]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.periodos).toEqual(["2026-01", "2026-02"]);
    expect(rows[0]?.facturacionPorPeriodo).toEqual({
      "2026-01": 150,
      "2026-02": 30
    });
    expect(rows[0]?.ventasPorPeriodo).toEqual({
      "2026-01": 1500,
      "2026-02": 200
    });
    expect(rows[0]?.totalFacturado).toBe(180);
    expect(rows[0]?.totalVentas).toBe(1700);
    expect(rows[0]?.costoOcupacion).toBeCloseTo(10.588235, 5);
  });

  it("returns null cost when there are no sales", () => {
    const rows = buildTenantFinanceRows(
      [
        {
          id: "tenant-1",
          rut: "11-1",
          razonSocial: "Acme Limitada",
          nombreComercial: "Acme",
          contratos: [
            {
              localId: "local-1",
              local: { id: "local-1", codigo: "L1", nombre: "Local 1" }
            }
          ]
        }
      ],
      [
        {
          localId: "local-1",
          periodo: new Date("2026-01-01T00:00:00.000Z"),
          valorUf: 100
        }
      ],
      []
    );

    expect(rows[0]?.totalVentas).toBe(0);
    expect(rows[0]?.costoOcupacion).toBeNull();
  });
});
