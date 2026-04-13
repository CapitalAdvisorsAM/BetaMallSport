import type { TenantFinanceRow } from "@/types/finance";

type NumericLike = number | string | { toString(): string };

type TenantContract = {
  localId: string;
  local: {
    id: string;
    codigo: string;
    nombre: string;
    glam2?: NumericLike;
  };
  tarifas?: {
    tipo: string;
    valor: NumericLike;
  }[];
  ggcc?: {
    tarifaBaseUfM2: NumericLike;
    pctAdministracion: NumericLike;
  }[];
};

type TenantBase = {
  id: string;
  rut: string;
  razonSocial: string;
  nombreComercial: string;
  contratos: TenantContract[];
};

type RegistroContableBase = {
  localId: string | null;
  periodo: Date;
  valorUf: NumericLike;
};

type VentaLocalBase = {
  tenantId: string;
  periodo: string;
  ventasUf: NumericLike;
};

function appendPeriodValue(
  target: Map<string, Map<string, number>>,
  localId: string,
  periodo: string,
  value: number
): void {
  const valuesByPeriod = target.get(localId) ?? new Map<string, number>();
  valuesByPeriod.set(periodo, (valuesByPeriod.get(periodo) ?? 0) + value);
  target.set(localId, valuesByPeriod);
}

export function buildTenantFinanceRows(
  tenants: TenantBase[],
  registros: RegistroContableBase[],
  ventas: VentaLocalBase[]
): TenantFinanceRow[] {
  const billingByLocal = new Map<string, Map<string, number>>();
  const salesByTenant = new Map<string, Map<string, number>>();

  registros.forEach((registro) => {
    if (!registro.localId) return; // skip property-level cost rows
    appendPeriodValue(
      billingByLocal,
      registro.localId,
      registro.periodo.toISOString().slice(0, 7),
      Number(registro.valorUf)
    );
  });

  ventas.forEach((venta) => {
    appendPeriodValue(salesByTenant, venta.tenantId, venta.periodo, Number(venta.ventasUf));
  });

  return tenants.flatMap((tenant) => {
    const uniqueContracts = new Map(
      tenant.contratos.map((contract) => [
        contract.localId,
        {
          id: contract.local.id,
          codigo: contract.local.codigo,
          nombre: contract.local.nombre
        }
      ])
    );

    if (uniqueContracts.size === 0) {
      return [];
    }

    const facturacionPorPeriodo: Record<string, number> = {};
    const ventasPorPeriodo: Record<string, number> = {};
    const periodos = new Set<string>();

    uniqueContracts.forEach((_, localId) => {
      billingByLocal.get(localId)?.forEach((value, periodo) => {
        facturacionPorPeriodo[periodo] = (facturacionPorPeriodo[periodo] ?? 0) + value;
        periodos.add(periodo);
      });
    });

    // Sales are now keyed by tenant ID, not by local
    salesByTenant.get(tenant.id)?.forEach((value, periodo) => {
      ventasPorPeriodo[periodo] = (ventasPorPeriodo[periodo] ?? 0) + value;
      periodos.add(periodo);
    });

    const totalFacturado = Object.values(facturacionPorPeriodo).reduce((acc, value) => acc + value, 0);
    const totalVentas = Object.values(ventasPorPeriodo).reduce((acc, value) => acc + value, 0);

    // Calculate expected billing from contract rates (if data is available)
    let totalEsperado: number | null = null;
    for (const contract of tenant.contratos) {
      if (!contract.tarifas || !contract.local.glam2) continue;
      const glam2 = Number(contract.local.glam2.toString());
      const tarifaFija = contract.tarifas.find((t) => t.tipo === "FIJO_UF_M2");
      const rentaFija = glam2 * Number(tarifaFija?.valor?.toString() ?? "0");
      const ggccEntry = contract.ggcc?.[0];
      const ggccUf = ggccEntry
        ? Number(ggccEntry.tarifaBaseUfM2.toString()) * glam2 * (1 + Number(ggccEntry.pctAdministracion.toString()) / 100)
        : 0;
      const monthlyExpected = rentaFija + ggccUf;
      if (monthlyExpected > 0) {
        // Multiply by number of periods with billing data
        const billingPeriods = periodos.size > 0 ? periodos.size : 1;
        totalEsperado = (totalEsperado ?? 0) + monthlyExpected * billingPeriods;
      }
    }

    const brechaUf = totalEsperado !== null ? totalEsperado - totalFacturado : null;
    const brechaPct = totalEsperado !== null && totalEsperado > 0
      ? (brechaUf! / totalEsperado) * 100
      : null;

    return [
      {
        id: tenant.id,
        rut: tenant.rut,
        razonSocial: tenant.razonSocial,
        nombreComercial: tenant.nombreComercial,
        locales: [...uniqueContracts.values()],
        periodos: [...periodos].sort(),
        facturacionPorPeriodo,
        ventasPorPeriodo,
        totalFacturado,
        totalVentas,
        costoOcupacion: totalVentas > 0 ? (totalFacturado / totalVentas) * 100 : null,
        totalEsperado,
        brechaUf,
        brechaPct
      }
    ];
  });
}

