import type { TenantFinanceRow } from "@/types/finanzas";

type NumericLike = number | string | { toString(): string };

type TenantContract = {
  localId: string;
  local: {
    id: string;
    codigo: string;
    nombre: string;
  };
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
  localId: string;
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
  const salesByLocal = new Map<string, Map<string, number>>();

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
    appendPeriodValue(salesByLocal, venta.localId, venta.periodo, Number(venta.ventasUf));
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

      salesByLocal.get(localId)?.forEach((value, periodo) => {
        ventasPorPeriodo[periodo] = (ventasPorPeriodo[periodo] ?? 0) + value;
        periodos.add(periodo);
      });
    });

    const totalFacturado = Object.values(facturacionPorPeriodo).reduce((acc, value) => acc + value, 0);
    const totalVentas = Object.values(ventasPorPeriodo).reduce((acc, value) => acc + value, 0);

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
        costoOcupacion: totalVentas > 0 ? (totalFacturado / totalVentas) * 100 : null
      }
    ];
  });
}
