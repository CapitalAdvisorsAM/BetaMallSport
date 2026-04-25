import { ContractRateType, ContractStatus } from "@prisma/client";
import { type RentRollDashboardTableRow } from "@/components/plan/RentRollDashboardTable";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { buildOcupacionDetalle, calculateWalt } from "@/lib/kpi";
import { daysUntilDate } from "@/lib/plan/metrics";
import { getPeriodoFromFecha, parseDateParam } from "@/lib/plan/snapshot-date";
import { prisma } from "@/lib/prisma";
import { calcTieredVariableRent, shiftPeriod } from "@/lib/real/billing-utils";

export type RentRollSnapshotResult = {
  rows: RentRollDashboardTableRow[];
  fecha: string;
  fechaReferencia: Date;
  periodoVentasVariable: string;
  contractCount: number;
  vacantCount: number;
  totals: {
    glam2: number;
    rentaFijaUf: number;
    ggccUf: number;
    rentaVariableUf: number;
  };
  glaArrendada: number;
  glaTotal: number;
  walt: number;
  ocupacionDetalle: ReturnType<typeof buildOcupacionDetalle>;
};

/**
 * Builds the rent roll snapshot rows for a given project and date.
 * Used by the page (`/plan/rent-roll`) and the Excel exporter to ensure both
 * sources show the same data.
 */
export async function buildRentRollSnapshotRows(
  projectId: string,
  fecha: string
): Promise<RentRollSnapshotResult> {
  const fechaReferencia = parseDateParam(fecha);
  const periodoVentas = getPeriodoFromFecha(fecha);
  const periodoVentasVariable = shiftPeriod(periodoVentas, -VARIABLE_RENT_LAG_MONTHS);

  const [contracts, budgetedSalesRaw, localesActivos, latestValorUf] = await Promise.all([
    prisma.contract.findMany({
      where: {
        projectId,
        estado: { in: [ContractStatus.VIGENTE, ContractStatus.GRACIA] },
        fechaInicio: { lte: fechaReferencia },
        fechaTermino: { gte: fechaReferencia }
      },
      include: {
        local: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            glam2: true,
            esGLA: true,
            tipo: true,
            zona: { select: { nombre: true } }
          }
        },
        arrendatario: {
          select: {
            nombreComercial: true
          }
        },
        tarifas: {
          where: {
            supersededAt: null,
            tipo: { in: [ContractRateType.FIJO_UF_M2, ContractRateType.PORCENTAJE] },
            vigenciaDesde: { lte: fechaReferencia },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }]
          },
          orderBy: [{ vigenciaDesde: "desc" }],
          select: {
            tipo: true,
            valor: true,
            umbralVentasUf: true
          }
        },
        ggcc: {
          where: {
            supersededAt: null,
            vigenciaDesde: { lte: fechaReferencia },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }]
          },
          orderBy: [{ vigenciaDesde: "desc" }],
          take: 1,
          select: {
            tarifaBaseUfM2: true,
            pctAdministracion: true
          }
        }
      },
      orderBy: [{ local: { codigo: "asc" } }]
    }),
    prisma.tenantBudgetedSale.findMany({
      where: {
        projectId,
        period: new Date(`${periodoVentasVariable}-01`)
      },
      select: {
        tenantId: true,
        salesPesos: true
      }
    }),
    prisma.unit.findMany({
      where: {
        projectId,
        estado: "ACTIVO"
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        tipo: true,
        esGLA: true,
        glam2: true,
        zona: { select: { nombre: true } }
      }
    }),
    prisma.valorUF.findFirst({ orderBy: { fecha: "desc" }, select: { valor: true } })
  ]);

  const ufRate = latestValorUf ? Number(latestValorUf.valor.toString()) : 0;

  const budgetedByTenantId = new Map<string, number>();
  for (const row of budgetedSalesRaw) {
    if (!budgetedByTenantId.has(row.tenantId)) {
      budgetedByTenantId.set(row.tenantId, Number(row.salesPesos));
    }
  }

  const contractRows: RentRollDashboardTableRow[] = contracts.map((contract) => {
    const glam2 = Number(contract.local.glam2);
    const tarifaFija = contract.tarifas.find(
      (tarifa) => tarifa.tipo === ContractRateType.FIJO_UF_M2
    );
    const tarifasVariable = contract.tarifas.filter(
      (tarifa) => tarifa.tipo === ContractRateType.PORCENTAJE
    );
    const tiers = tarifasVariable.map((t) => ({
      umbralVentasUf: Number(t.umbralVentasUf?.toString() ?? "0"),
      pct: Number(t.valor)
    }));
    const tarifaUfM2 = tarifaFija?.valor ? Number(tarifaFija.valor) : 0;
    const rentaFijaUf = glam2 * tarifaUfM2;

    const ggccActual = contract.ggcc[0];
    const ggccTarifaBaseUfM2 = ggccActual ? Number(ggccActual.tarifaBaseUfM2) : null;
    const ggccPctAdministracion = ggccActual ? Number(ggccActual.pctAdministracion) : null;
    const ggccUf = ggccActual
      ? Number(ggccActual.tarifaBaseUfM2) *
        glam2 *
        (1 + Number(ggccActual.pctAdministracion) / 100)
      : 0;

    const ventasPresupuestadasPesos = budgetedByTenantId.get(contract.arrendatarioId) ?? null;
    const ventasPresupuestadasUf =
      ventasPresupuestadasPesos !== null && ufRate > 0 ? ventasPresupuestadasPesos / ufRate : null;
    const rentaVariableUf =
      ventasPresupuestadasUf !== null && tiers.length > 0
        ? calcTieredVariableRent(ventasPresupuestadasUf, tiers, rentaFijaUf)
        : null;
    const pctRentaVariable = tiers.length > 0 ? tiers[0].pct : null;
    const pctFondoPromocion = contract.pctFondoPromocion
      ? Number(contract.pctFondoPromocion)
      : null;

    const fechaTerminoIso = contract.fechaTermino.toISOString().slice(0, 10);
    const diasParaVencer = daysUntilDate(fechaReferencia, contract.fechaTermino);

    return {
      id: contract.id,
      localId: contract.localId,
      tenantId: contract.arrendatarioId,
      local: `${contract.local.codigo} - ${contract.local.nombre}`,
      arrendatario: contract.arrendatario.nombreComercial,
      zona: contract.local.zona?.nombre ?? null,
      tipo: contract.local.tipo,
      glam2,
      tarifaUfM2,
      rentaFijaUf,
      ggccUf,
      ggccTarifaBaseUfM2,
      ggccPctAdministracion,
      ventasPresupuestadasPesos,
      pctRentaVariable,
      rentaVariableUf,
      pctFondoPromocion,
      vacante: false,
      cuentaParaVacancia: contract.cuentaParaVacancia,
      fechaTermino: fechaTerminoIso,
      diasParaVencer
    };
  });

  // Only contracts flagged as `cuentaParaVacancia` block a local from being vacant.
  // A contract with the flag = false still appears as its own row above, but the
  // local also surfaces as a vacant row so vacancy KPIs reflect it correctly.
  const localesOcupadosParaVacancia = new Set(
    contracts.filter((c) => c.cuentaParaVacancia).map((c) => c.localId)
  );
  const vacantRows: RentRollDashboardTableRow[] = localesActivos
    .filter((unit) => unit.esGLA && !localesOcupadosParaVacancia.has(unit.id))
    .map((unit) => ({
      id: `vacant-${unit.id}`,
      localId: unit.id,
      tenantId: null,
      local: `${unit.codigo} - ${unit.nombre}`,
      arrendatario: "—",
      zona: unit.zona?.nombre ?? null,
      tipo: unit.tipo,
      glam2: Number(unit.glam2),
      tarifaUfM2: 0,
      rentaFijaUf: 0,
      ggccUf: 0,
      ggccTarifaBaseUfM2: null,
      ggccPctAdministracion: null,
      ventasPresupuestadasPesos: null,
      pctRentaVariable: null,
      rentaVariableUf: null,
      pctFondoPromocion: null,
      vacante: true,
      cuentaParaVacancia: false,
      fechaTermino: null,
      diasParaVencer: null
    }));

  const rows = [...contractRows, ...vacantRows];

  const totals = rows.reduce(
    (acc, row) => {
      acc.glam2 += row.glam2;
      acc.rentaFijaUf += row.rentaFijaUf;
      acc.ggccUf += row.ggccUf;
      if (row.rentaVariableUf != null) {
        acc.rentaVariableUf += row.rentaVariableUf;
      }
      return acc;
    },
    { glam2: 0, rentaFijaUf: 0, ggccUf: 0, rentaVariableUf: 0 }
  );

  const glaTotal = localesActivos
    .filter((unit) => unit.esGLA)
    .reduce((sum, unit) => sum + Number(unit.glam2), 0);
  // Solo cuentan los contratos que aportan a vacancia.
  const glaArrendada = contractRows
    .filter((row) => row.cuentaParaVacancia)
    .reduce((sum, row) => sum + row.glam2, 0);

  const walt = calculateWalt(
    contracts.map((contract) => ({
      fechaTermino: contract.fechaTermino,
      localGlam2: contract.local.glam2
    })),
    fechaReferencia
  );

  const ocupacionDetalle = buildOcupacionDetalle(
    localesActivos.map((l) => ({ ...l, zona: l.zona?.nombre ?? null })),
    contracts
      .filter((contract) => contract.cuentaParaVacancia)
      .map((contract) => ({
        localId: contract.localId,
        localGlam2: contract.local.glam2,
        fechaTermino: contract.fechaTermino,
        tarifa: null
      }))
  );

  return {
    rows,
    fecha,
    fechaReferencia,
    periodoVentasVariable,
    contractCount: contractRows.length,
    vacantCount: vacantRows.length,
    totals,
    glaArrendada,
    glaTotal,
    walt,
    ocupacionDetalle
  };
}
