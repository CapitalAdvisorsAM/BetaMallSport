import { ContractRateType } from "@prisma/client";
import { redirect } from "next/navigation";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RentRollDashboardTable, type RentRollDashboardTableRow } from "@/components/rent-roll/RentRollDashboardTable";
import { OccupancyBySizeTable } from "@/components/rent-roll/OccupancyBySizeTable";
import { OcupacionTipoTable } from "@/components/rent-roll/OcupacionTipoTable";
import { RentRollSnapshotDatePicker } from "@/components/rent-roll/RentRollSnapshotDatePicker";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { VARIABLE_RENT_LAG_MONTHS } from "@/lib/constants";
import { shiftPeriod, calcTieredVariableRent } from "@/lib/finance/billing-utils";
import { buildOcupacionDetalle, calculateWalt } from "@/lib/kpi";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext, resolveProjectIdFromSearchParams } from "@/lib/project";
import {
  formatWaltValue,
  getPeriodoFromFecha,
  parseDateParam,
  resolveSnapshotDate
} from "@/lib/rent-roll/snapshot-date";
import { buildActualBillingByUnit } from "@/lib/shared/gap-utils";
import { formatDecimal } from "@/lib/utils";

type RentRollPageProps = {
  searchParams: {
    project?: string;
    periodo?: string;
    fecha?: string;
  };
};

export default async function RentRollPage({
  searchParams
}: RentRollPageProps): Promise<JSX.Element> {
  const session = await requireSession();
  const projectParam = resolveProjectIdFromSearchParams(searchParams);

  const { selectedProjectId } = await getProjectContext(projectParam);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Rent Roll"
        description="No hay proyectos activos. Crea uno para visualizar metricas por local."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  const fecha = resolveSnapshotDate(searchParams.fecha, searchParams.periodo);
  const fechaReferencia = parseDateParam(fecha);
  const periodoVentas = getPeriodoFromFecha(fecha);

  if (
    projectParam !== selectedProjectId ||
    searchParams.fecha !== fecha ||
    searchParams.periodo
  ) {
    const params = new URLSearchParams();
    params.set("project", selectedProjectId);
    params.set("fecha", fecha);
    redirect(`/rent-roll?${params.toString()}`);
  }

  const periodoVentasVariable = shiftPeriod(periodoVentas, -VARIABLE_RENT_LAG_MONTHS);

  const [contracts, unitSalesRaw, budgetedSalesRaw, localesActivos, accountingRaw] = await Promise.all([
    prisma.contract.findMany({
      where: {
        proyectoId: selectedProjectId,
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
    prisma.tenantSale.findMany({
      where: {
        projectId: selectedProjectId,
        period: new Date(`${periodoVentas}-01`)
      },
      select: {
        tenantId: true,
        salesUf: true,
        createdAt: true
      },
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.tenantBudgetedSale.findMany({
      where: {
        projectId: selectedProjectId,
        period: new Date(`${periodoVentasVariable}-01`)
      },
      select: {
        tenantId: true,
        salesUf: true
      }
    }),
    prisma.unit.findMany({
      where: {
        proyectoId: selectedProjectId,
        estado: "ACTIVO"
      },
      select: {
        id: true,
        tipo: true,
        esGLA: true,
        glam2: true,
        zona: { select: { nombre: true } }
      }
    }),
    prisma.accountingRecord.findMany({
      where: {
        projectId: selectedProjectId,
        period: new Date(`${periodoVentas}-01`),
        group1: "INGRESOS DE EXPLOTACION"
      },
      select: {
        unitId: true,
        valueUf: true,
        group1: true
      }
    })
  ]);

  const ventasByTenantId = new Map<string, number>();
  for (const sale of unitSalesRaw) {
    if (!ventasByTenantId.has(sale.tenantId)) {
      ventasByTenantId.set(sale.tenantId, Number(sale.salesUf));
    }
  }

  const budgetedByTenantId = new Map<string, number>();
  for (const row of budgetedSalesRaw) {
    if (!budgetedByTenantId.has(row.tenantId)) {
      budgetedByTenantId.set(row.tenantId, Number(row.salesUf));
    }
  }

  const actualBillingByUnit = buildActualBillingByUnit(
    accountingRaw.map((r) => ({
      unitId: r.unitId,
      valueUf: Number(r.valueUf),
      group1: r.group1
    }))
  );
  const hasAccountingData = accountingRaw.length > 0;

  const rows: RentRollDashboardTableRow[] = contracts.map((contract) => {
    const glam2 = Number(contract.local.glam2);
    const tarifaFija = contract.tarifas.find(
      (tarifa) => tarifa.tipo === ContractRateType.FIJO_UF_M2
    );
    const tarifasVariable = contract.tarifas.filter(
      (tarifa) => tarifa.tipo === ContractRateType.PORCENTAJE
    );
    const tiers = tarifasVariable.map((t) => ({
      umbralVentasUf: Number(t.umbralVentasUf?.toString() ?? "0"),
      pct: Number(t.valor),
    }));
    const tarifaUfM2 = tarifaFija?.valor ? Number(tarifaFija.valor) : 0;
    const rentaFijaUf = glam2 * tarifaUfM2;

    const ggccActual = contract.ggcc[0];
    const ggccUf = ggccActual
      ? Number(ggccActual.tarifaBaseUfM2) *
        glam2 *
        (1 + Number(ggccActual.pctAdministracion) / 100)
      : 0;

    const ventasUf = ventasByTenantId.has(contract.arrendatarioId)
      ? (ventasByTenantId.get(contract.arrendatarioId) ?? null)
      : null;
    const ventasPresupuestadasUf = budgetedByTenantId.get(contract.arrendatarioId) ?? null;
    const rentaVariableUf =
      ventasPresupuestadasUf !== null && tiers.length > 0
        ? calcTieredVariableRent(ventasPresupuestadasUf, tiers, rentaFijaUf)
        : null;
    const pctRentaVariable = tiers.length > 0 ? tiers[0].pct : null;
    const pctFondoPromocion = contract.pctFondoPromocion
      ? Number(contract.pctFondoPromocion)
      : null;

    const expectedUf = rentaFijaUf + ggccUf + (rentaVariableUf ?? 0);
    const facturadoRealUf = actualBillingByUnit.get(contract.localId) ?? null;
    const brechaUf = facturadoRealUf !== null ? expectedUf - facturadoRealUf : null;
    const brechaPct = facturadoRealUf !== null && expectedUf > 0
      ? (brechaUf! / expectedUf) * 100
      : null;

    return {
      id: contract.id,
      localId: contract.localId,
      tenantId: contract.arrendatarioId,
      local: `${contract.local.codigo} - ${contract.local.nombre}`,
      arrendatario: contract.arrendatario.nombreComercial,
      glam2,
      tarifaUfM2,
      rentaFijaUf,
      ggccUf,
      ventasUf,
      ventasPresupuestadasUf,
      pctRentaVariable,
      rentaVariableUf,
      pctFondoPromocion,
      facturadoRealUf,
      brechaUf,
      brechaPct
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.glam2 += row.glam2;
      acc.rentaFijaUf += row.rentaFijaUf;
      acc.ggccUf += row.ggccUf;
      if (row.ventasUf != null) {
        acc.ventasUf += row.ventasUf;
      }
      if (row.rentaVariableUf != null) {
        acc.rentaVariableUf += row.rentaVariableUf;
      }
      if (row.facturadoRealUf != null) {
        acc.facturadoRealUf += row.facturadoRealUf;
      }
      if (row.brechaUf != null) {
        acc.brechaUf += row.brechaUf;
      }
      return acc;
    },
    { glam2: 0, rentaFijaUf: 0, ggccUf: 0, ventasUf: 0, rentaVariableUf: 0, facturadoRealUf: 0, brechaUf: 0 }
  );

  const totalEsperado = totals.rentaFijaUf + totals.ggccUf + totals.rentaVariableUf;
  const totalBrechaPct = hasAccountingData && totalEsperado > 0
    ? (totals.brechaUf / totalEsperado) * 100
    : null;

  const ocupacionDetalle = buildOcupacionDetalle(
    localesActivos.map((l) => ({ ...l, zona: l.zona?.nombre ?? null })),
    contracts.map((contract) => ({
      localId: contract.localId,
      localGlam2: contract.local.glam2,
      fechaTermino: contract.fechaTermino,
      tarifa: null
    }))
  );

  const walt = calculateWalt(
    contracts.map((contract) => ({
      fechaTermino: contract.fechaTermino,
      localGlam2: contract.local.glam2
    })),
    fechaReferencia
  );

  const tamanoRows = [
    { key: "Tienda Mayor", label: "Tienda Mayor" },
    { key: "Tienda Mediana", label: "Tienda Mediana" },
    { key: "Tienda Menor", label: "Tienda Menor" },
    { key: "Modulo", label: "Modulo" },
    { key: "Bodega", label: "Bodega" }
  ] as const;
  const ocupacionRows = tamanoRows.map((row) => {
    const data = ocupacionDetalle.porTamano[row.key] ?? {
      gla: 0,
      glaArrendada: 0,
      pctVacancia: 0
    };

    return {
      tipo: row.label,
      glaTotal: data.gla,
      glaArrendada: data.glaArrendada,
      vacante: Math.max(data.gla - data.glaArrendada, 0),
      pctVacancia: data.pctVacancia
    };
  });

  const categoriaRows = Object.entries(ocupacionDetalle.porCategoria)
    .filter(([, data]) => data.gla > 0)
    .map(([categoria, data]) => ({
      categoria,
      glaTotal: data.gla,
      glaArrendada: data.glaArrendada,
      vacante: Math.max(data.gla - data.glaArrendada, 0),
      pctDelTotal: data.pct,
      pctVacancia: data.pctVacancia
    }));

  return (
    <main className="space-y-4">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                Rent Roll
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Vista operacional snapshot: estado contractual actual y metricas en una fecha exacta.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <RentRollSnapshotDatePicker projectId={selectedProjectId} selectedDate={fecha} />
          <div className="rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
            <div><span className="font-semibold">Ventas reales:</span> {periodoVentas}</div>
            <div><span className="font-semibold">Presupuesto (renta variable):</span> {periodoVentasVariable}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
        <KpiCard
          metricId="kpi_rent_roll_snapshot_renta_fija_total_uf"
          title="Renta fija total (UF)"
          value={formatDecimal(totals.rentaFijaUf)}
          accent="slate"
        />
        <KpiCard
          metricId="kpi_rent_roll_snapshot_ggcc_total_uf"
          title="GGCC total (UF)"
          value={formatDecimal(totals.ggccUf)}
          accent="slate"
        />
        <KpiCard
          metricId="kpi_rent_roll_snapshot_ventas_periodo_uf"
          title="Ventas periodo (UF)"
          value={formatDecimal(totals.ventasUf)}
          accent="slate"
        />
        <KpiCard
          metricId="kpi_rent_roll_snapshot_walt_global"
          title="WALT global"
          value={formatWaltValue(walt)}
          subtitle={walt > 0 ? `Promedio ponderado al ${fecha}` : "Sin contratos activos"}
          accent="yellow"
        />
        {hasAccountingData && (
          <>
            <KpiCard
              metricId="kpi_rent_roll_snapshot_facturacion_esperada_vs_real"
              title="Esperado vs Real (UF)"
              value={`${formatDecimal(totalEsperado)} / ${formatDecimal(totals.facturadoRealUf)}`}
              subtitle={`Periodo contable: ${periodoVentas}`}
              accent={totalBrechaPct !== null && Math.abs(totalBrechaPct) >= 10 ? "red" : "green"}
            />
            <KpiCard
              metricId="kpi_rent_roll_snapshot_brecha_total"
              title="Brecha total"
              value={`${formatDecimal(totals.brechaUf)} UF`}
              subtitle={totalBrechaPct !== null ? `${formatDecimal(totalBrechaPct)}% del esperado` : undefined}
              accent={totalBrechaPct !== null && Math.abs(totalBrechaPct) >= 10 ? "red" : totalBrechaPct !== null && Math.abs(totalBrechaPct) >= 2 ? "yellow" : "green"}
            />
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="overflow-hidden rounded-md bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-700">Ocupacion por tamano</h3>
          </div>
          <OccupancyBySizeTable rows={ocupacionRows} />
        </article>
        <article className="overflow-hidden rounded-md bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-700">Ocupacion por categoria</h3>
          </div>
          <OcupacionTipoTable rows={categoriaRows} />
        </article>
      </section>

      <RentRollDashboardTable rows={rows} snapshotDate={fecha} proyectoId={selectedProjectId} hasAccountingData={hasAccountingData} />
    </main>
  );
}

