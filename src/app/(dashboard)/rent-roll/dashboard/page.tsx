import { TipoTarifaContrato } from "@prisma/client";
import { redirect } from "next/navigation";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  RentRollDashboardTable,
  type RentRollDashboardTableRow
} from "@/components/rent-roll/RentRollDashboardTable";
import { Button } from "@/components/ui/button";
import { ProjectCreationPanel } from "@/components/ui/ProjectCreationPanel";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { RentRollChartsSection } from "@/components/rent-roll/RentRollChartsSection";
import { buildOcupacionDetalle } from "@/lib/kpi";
import { canWrite, requireSession } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";
import { getTimelineData } from "@/lib/rent-roll/timeline";
import { formatDecimal } from "@/lib/utils";

type RentRollDashboardPageProps = {
  searchParams: {
    proyecto?: string;
    periodo?: string;
  };
};

function formatPeriod(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildLastPeriods(totalMonths: number): string[] {
  const now = new Date();
  return Array.from({ length: totalMonths }, (_, index) => {
    const value = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return formatPeriod(value);
  });
}

function getPeriodoBounds(periodo: string): { start: Date; nextMonthStart: Date } {
  const [yearRaw, monthRaw] = periodo.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    nextMonthStart: new Date(Date.UTC(year, monthIndex + 1, 1))
  };
}

function isValidPeriod(value?: string): value is string {
  if (!value) {
    return false;
  }
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
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

  const currentPeriod = formatPeriod(new Date());
  const periodo = isValidPeriod(searchParams.periodo) ? searchParams.periodo : currentPeriod;

  if (searchParams.proyecto !== selectedProjectId || searchParams.periodo !== periodo) {
    const params = new URLSearchParams();
    params.set("proyecto", selectedProjectId);
    params.set("periodo", periodo);
    redirect(`/rent-roll/dashboard?${params.toString()}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { start, nextMonthStart } = getPeriodoBounds(periodo);

  const [contracts, ventaLocales, localesActivos, timelineData] = await Promise.all([
    prisma.contrato.findMany({
      where: {
        proyectoId: selectedProjectId,
        contratosDia: {
          some: {
            fecha: { gte: start, lt: nextMonthStart },
            estadoDia: { in: ["OCUPADO", "GRACIA"] }
          }
        }
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
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
          },
          orderBy: [{ vigenciaDesde: "desc" }],
          select: {
            tipo: true,
            valor: true
          }
        },
        ggcc: {
          where: {
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
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
        periodo
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
    const tarifaFija = contract.tarifas.find((t) => t.tipo === TipoTarifaContrato.FIJO_UF_M2);
    const tarifaVariable = contract.tarifas.find((t) => t.tipo === TipoTarifaContrato.PORCENTAJE);
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
      ventasUf !== null && pctRentaVariable !== null
        ? ventasUf * (pctRentaVariable / 100)
        : null;

    const pctFondoPromocion = contract.pctFondoPromocion
      ? Number(contract.pctFondoPromocion)
      : null;

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

  const periodOptions = buildLastPeriods(12);
  const ocupacionDetalle = buildOcupacionDetalle(
    localesActivos,
    contracts.map((contract) => ({
      localId: contract.localId,
      localGlam2: contract.local.glam2,
      fechaTermino: contract.fechaTermino,
      tarifa: null
    }))
  );
  const categoriaRows = [
    { key: "Outdoor", label: "Outdoor" },
    { key: "Multideporte", label: "Multideporte" },
    { key: "Bicicletas", label: "Bicicletas" },
    { key: "Entretencion", label: "Entretenci\u00f3n" },
    { key: "Accesorios", label: "Accesorios" },
    { key: "Gastronomia", label: "Gastronom\u00eda" },
    { key: "Gimnasio", label: "Gimnasio" },
    { key: "Servicios", label: "Servicios" },
    { key: "Lifestyle", label: "Lifestyle" },
    { key: "Powersports", label: "Powersports" }
  ] as const;
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
              Metricas clave por local para contratos con ocupacion derivada por periodo.
            </p>
          </div>
          <ProjectSelector
            projects={projects}
            selectedProjectId={selectedProjectId}
            preserve={{ periodo }}
          />
        </div>
      </header>

      <section className="rounded-md bg-white p-4 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[220px_auto]">
          <input type="hidden" name="proyecto" value={selectedProjectId} />
          <Select
            name="periodo"
            defaultValue={periodo}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {periodOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="submit"
            className="rounded-full"
          >
            Aplicar periodo
          </Button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Renta fija total (UF)" value={formatDecimal(totals.rentaFijaUf)} accent="slate" />
        <KpiCard title="GGCC total (UF)" value={formatDecimal(totals.ggccUf)} accent="slate" />
        <KpiCard title="Ventas periodo (UF)" value={formatDecimal(totals.ventasUf)} accent="slate" />
      </section>

      <RentRollChartsSection periodos={timelineData.periodos} />

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="overflow-hidden rounded-md bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-700">Ocupacion por categoria</h3>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-slate-200 text-sm">
              <TableHeader className="bg-brand-700">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Categoria
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                    GLA (m2)
                  </TableHead>
                  <TableHead className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-white/70">
                    % del total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-slate-800">
                {categoriaRows.map((row, index) => {
                  const data = ocupacionDetalle.porCategoria[row.key] ?? { gla: 0, pct: 0 };
                  return (
                    <TableRow key={row.key} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <TableCell className="px-4 py-3">
                        <div className="text-sm font-medium">{row.label}</div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${Math.min(100, Math.max(0, data.pct))}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                        {formatDecimal(data.gla)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                        {formatDecimal(data.pct)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </article>

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
