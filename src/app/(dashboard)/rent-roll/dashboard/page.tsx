import { TipoTarifaContrato } from "@prisma/client";
import { redirect } from "next/navigation";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  RentRollDashboardTable,
  type RentRollDashboardTableRow
} from "@/components/rent-roll/RentRollDashboardTable";
import { RentRollChartsSection } from "@/components/rent-roll/RentRollChartsSection";
import {
  RentRollSnapshotDatePicker
} from "@/components/rent-roll/RentRollSnapshotDatePicker";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  buildOcupacionDetalle,
  calculateWalt,
  mapCategoria
} from "@/lib/kpi";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { getTimelineData } from "@/lib/rent-roll/timeline";
import { formatDecimal, startOfDay } from "@/lib/utils";
import type { RentRollCategoryConcentrationDatum } from "@/components/rent-roll/RentRollCategoryConcentration";

type RentRollDashboardPageProps = {
  searchParams: {
    proyecto?: string;
    periodo?: string;
    fecha?: string;
  };
};

function isValidPeriod(value?: string): value is string {
  if (!value) {
    return false;
  }
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isValidDate(value?: string): value is string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) {
    return false;
  }

  const parsed = parseDateParam(value);
  return formatDateParam(parsed) === value;
}

function parseDateParam(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateParam(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveSnapshotDate(fecha?: string, periodo?: string): string {
  if (isValidDate(fecha)) {
    return fecha;
  }

  if (isValidPeriod(periodo)) {
    return `${periodo}-01`;
  }

  return formatDateParam(startOfDay(new Date()));
}

function getPeriodoFromFecha(fecha: string): string {
  return fecha.slice(0, 7);
}

function formatWaltValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "\u2013";
  }

  if (value > 24) {
    return `${formatOneDecimal(value / 12)} a\u00f1os`;
  }

  return `${formatOneDecimal(value)} meses`;
}

function formatOneDecimal(value: number): string {
  const formatted = formatDecimal(Math.round(value * 10) / 10);
  return formatted.replace(/([,.]\d)\d$/, "$1");
}

function buildCategoryConcentration(
  contracts: Array<{
    local: { glam2: number | { toString(): string }; zona: string | null };
  }>
): RentRollCategoryConcentrationDatum[] {
  const grouped = new Map<string, { glam2: number; contratos: number }>();

  for (const contract of contracts) {
    const glam2 = Number(contract.local.glam2);
    if (glam2 <= 0) {
      continue;
    }

    const categoria = mapCategoria(contract.local.zona) ?? "Sin categoria";
    const current = grouped.get(categoria) ?? { glam2: 0, contratos: 0 };
    current.glam2 += glam2;
    current.contratos += 1;
    grouped.set(categoria, current);
  }

  const totalGla = Array.from(grouped.values()).reduce((acc, item) => acc + item.glam2, 0);
  if (totalGla <= 0) {
    return [];
  }

  const rows = Array.from(grouped.entries())
    .map(([categoria, value]) => ({
      categoria,
      glam2: value.glam2,
      contratos: value.contratos
    }))
    .sort((a, b) => b.glam2 - a.glam2);

  let pctAcumulado = 0;
  return rows.map((row, index) => {
    const pctBase = (row.glam2 / totalGla) * 100;
    const pct =
      index === rows.length - 1 ? Number((100 - pctAcumulado).toFixed(2)) : Number(pctBase.toFixed(2));
    pctAcumulado += pct;

    return {
      ...row,
      pct: Math.max(0, pct)
    };
  });
}

export default async function RentRollDashboardPage({
  searchParams
}: RentRollDashboardPageProps): Promise<JSX.Element> {
  const session = await requireSession();

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
  if (!selectedProjectId) {
    return (
      <ProjectCreationPanel
        title="Dashboard Rent Roll"
        description="No hay proyectos activos. Crea uno para visualizar metricas por local."
        canEdit={canWrite(session.user.role)}
      />
    );
  }

  const fecha = resolveSnapshotDate(searchParams.fecha, searchParams.periodo);
  const fechaReferencia = parseDateParam(fecha);
  const periodoVentas = getPeriodoFromFecha(fecha);

  if (
    searchParams.proyecto !== selectedProjectId ||
    searchParams.fecha !== fecha ||
    searchParams.periodo
  ) {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    params.set("fecha", fecha);
    redirect(`/rent-roll/dashboard?${params.toString()}`);
  }

  const [contracts, ventaLocales, localesActivos, timelineData] = await Promise.all([
    prisma.contrato.findMany({
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
            zona: true
          }
        },
        arrendatario: {
          select: {
            nombreComercial: true
          }
        },
        tarifas: {
          where: {
            tipo: { in: [TipoTarifaContrato.FIJO_UF_M2, TipoTarifaContrato.PORCENTAJE] },
            vigenciaDesde: { lte: fechaReferencia },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fechaReferencia } }]
          },
          orderBy: [{ vigenciaDesde: "desc" }],
          select: {
            tipo: true,
            valor: true
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
    prisma.ventaLocal.findMany({
      where: {
        proyectoId: selectedProjectId,
        periodo: periodoVentas
      },
      select: {
        localId: true,
        ventasUf: true,
        createdAt: true
      },
      orderBy: [{ createdAt: "desc" }]
    }),
    prisma.local.findMany({
      where: {
        proyectoId: selectedProjectId,
        estado: "ACTIVO"
      },
      select: {
        id: true,
        tipo: true,
        esGLA: true,
        glam2: true,
        zona: true
      }
    }),
    getTimelineData(selectedProjectId)
  ]);

  const ventasByLocalId = new Map<string, number>();
  for (const venta of ventaLocales) {
    if (!ventasByLocalId.has(venta.localId)) {
      ventasByLocalId.set(venta.localId, Number(venta.ventasUf));
    }
  }

  const rows: RentRollDashboardTableRow[] = contracts.map((contract) => {
    const glam2 = Number(contract.local.glam2);
    const tarifaFija = contract.tarifas.find((tarifa) => tarifa.tipo === TipoTarifaContrato.FIJO_UF_M2);
    const tarifaVariable = contract.tarifas.find(
      (tarifa) => tarifa.tipo === TipoTarifaContrato.PORCENTAJE
    );
    const tarifaUfM2 = tarifaFija?.valor ? Number(tarifaFija.valor) : 0;
    const rentaFijaUf = glam2 * tarifaUfM2;
    const pctRentaVariable = tarifaVariable?.valor ? Number(tarifaVariable.valor) : null;

    const ggccActual = contract.ggcc[0];
    const ggccUf = ggccActual
      ? Number(ggccActual.tarifaBaseUfM2) * glam2 * (1 + Number(ggccActual.pctAdministracion) / 100)
      : 0;

    const ventasUf = ventasByLocalId.has(contract.localId)
      ? (ventasByLocalId.get(contract.localId) ?? null)
      : null;
    const rentaVariableUf =
      ventasUf !== null && pctRentaVariable !== null ? ventasUf * (pctRentaVariable / 100) : null;
    const pctFondoPromocion = contract.pctFondoPromocion ? Number(contract.pctFondoPromocion) : null;

    return {
      id: contract.id,
      local: `${contract.local.codigo} - ${contract.local.nombre}`,
      arrendatario: contract.arrendatario.nombreComercial,
      glam2,
      tarifaUfM2,
      rentaFijaUf,
      ggccUf,
      ventasUf,
      pctRentaVariable,
      rentaVariableUf,
      pctFondoPromocion
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
      return acc;
    },
    { glam2: 0, rentaFijaUf: 0, ggccUf: 0, ventasUf: 0, rentaVariableUf: 0 }
  );

  const ocupacionDetalle = buildOcupacionDetalle(
    localesActivos,
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

  const categoryConcentration = buildCategoryConcentration(contracts);

  const tamanoRows = [
    { key: "Tienda Mayor", label: "Tienda Mayor" },
    { key: "Tienda Mediana", label: "Tienda Mediana" },
    { key: "Tienda Menor", label: "Tienda Menor" },
    { key: "Modulo", label: "M\u00f3dulo" },
    { key: "Bodega", label: "Bodega" }
  ] as const;

  return (
    <main className="space-y-4">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                Rent Roll Dashboard
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Snapshot por fecha exacta de contratos activos, KPIs comerciales y concentracion de GLA.
            </p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ fecha }}
          />
        </div>
      </header>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <RentRollSnapshotDatePicker projectId={selectedProjectId} selectedDate={fecha} />
          <div className="rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
            <span className="font-semibold">Periodo de ventas asociado:</span> {periodoVentas}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Renta fija total (UF)" value={formatDecimal(totals.rentaFijaUf)} accent="slate" />
        <KpiCard title="GGCC total (UF)" value={formatDecimal(totals.ggccUf)} accent="slate" />
        <KpiCard title="Ventas periodo (UF)" value={formatDecimal(totals.ventasUf)} accent="slate" />
        <KpiCard
          title="WALT"
          value={formatWaltValue(walt)}
          subtitle={walt > 0 ? `Promedio ponderado al ${fecha}` : "Sin contratos activos"}
          accent="yellow"
        />
      </section>

      <RentRollChartsSection
        periodos={timelineData.periodos}
        categoryConcentration={categoryConcentration}
      />

      <section>
        <article className="overflow-hidden rounded-md bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-700">Ocupacion por tamano</h3>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-slate-200 text-sm">
              <TableHeader className="bg-brand-700">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Tipo
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                    GLA Total
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                    GLA Arrendada
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Vacante
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                    % Vacancia
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-slate-800">
                {tamanoRows.map((row, index) => {
                  const data = ocupacionDetalle.porTamano[row.key] ?? {
                    gla: 0,
                    glaArrendada: 0,
                    pctVacancia: 0
                  };
                  const vacante = Math.max(data.gla - data.glaArrendada, 0);

                  return (
                    <TableRow key={row.key} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <TableCell className="whitespace-nowrap px-4 py-3 font-medium">{row.label}</TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                        {formatDecimal(data.gla)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                        {formatDecimal(data.glaArrendada)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                        {formatDecimal(vacante)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                        {formatDecimal(data.pctVacancia)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </article>
      </section>

      <RentRollDashboardTable rows={rows} totals={totals} />
    </main>
  );
}
