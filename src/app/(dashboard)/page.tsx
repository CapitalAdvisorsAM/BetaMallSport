import { EstadoContrato, EstadoMaestro } from "@prisma/client";
import { redirect } from "next/navigation";
import { ContractExpiryTable } from "@/components/dashboard/ContractExpiryTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProjectSelector } from "@/components/ui/ProjectSelector";
import { auth } from "@/lib/auth";
import {
  buildContractExpiryBuckets,
  buildFixedRentClpMetric,
  calculateContractStateCounters,
  calculateEstimatedGgccUf,
  calculateFixedRentUf,
  calculateGlaMetrics,
  calculateOccupancy,
  calculateVacancy,
  formatPercent,
  formatSquareMeters,
  formatUf,
  type KpiContractInput
} from "@/lib/kpi";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/project";

type DashboardPageProps = {
  searchParams: {
    proyecto?: string;
  };
};

export default async function DashboardPage({
  searchParams
}: DashboardPageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  if (!selectedProjectId) {
    return (
      <main className="rounded-md bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">KPIs</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">Selecciona un proyecto para ver los KPIs</p>
      </main>
    );
  }

  if (!searchParams.proyecto) {
    redirect(`/?proyecto=${selectedProjectId}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeLocales, vigenteContractsRaw, groupedStates, latestValorUf] = await Promise.all([
    prisma.local.findMany({
      where: {
        proyectoId: selectedProjectId,
        estado: EstadoMaestro.ACTIVO
      },
      orderBy: { codigo: "asc" },
      select: {
        id: true,
        codigo: true,
        esGLA: true,
        glam2: true
      }
    }),
    prisma.contrato.findMany({
      where: {
        proyectoId: selectedProjectId,
        estado: EstadoContrato.VIGENTE
      },
      orderBy: { fechaTermino: "asc" },
      select: {
        id: true,
        localId: true,
        numeroContrato: true,
        fechaTermino: true,
        local: {
          select: {
            codigo: true,
            esGLA: true,
            glam2: true
          }
        },
        arrendatario: {
          select: {
            nombreComercial: true
          }
        },
        tarifas: {
          where: {
            vigenciaDesde: { lte: today },
            OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: today } }]
          },
          orderBy: { vigenciaDesde: "desc" },
          take: 1,
          select: {
            tipo: true,
            valor: true
          }
        },
        ggcc: {
          where: {
            vigenciaDesde: { lte: today }
          },
          orderBy: { vigenciaDesde: "desc" },
          take: 1,
          select: {
            tarifaBaseUfM2: true,
            pctAdministracion: true
          }
        }
      }
    }),
    prisma.contrato.groupBy({
      by: ["estado"],
      where: { proyectoId: selectedProjectId },
      _count: { _all: true }
    }),
    prisma.valorUF.findFirst({
      orderBy: { fecha: "desc" },
      select: { fecha: true, valor: true }
    })
  ]);

  const contracts: KpiContractInput[] = vigenteContractsRaw.map((contract) => ({
    id: contract.id,
    localId: contract.localId,
    localCodigo: contract.local.codigo,
    localEsGLA: contract.local.esGLA,
    localGlam2: contract.local.glam2,
    arrendatarioNombre: contract.arrendatario.nombreComercial,
    numeroContrato: contract.numeroContrato,
    fechaTermino: contract.fechaTermino,
    tarifa: contract.tarifas[0] ?? null,
    ggcc: contract.ggcc[0] ?? null
  }));

  const occupancy = calculateOccupancy(activeLocales, contracts);
  const gla = calculateGlaMetrics(activeLocales, contracts);
  const vacancy = calculateVacancy(activeLocales, contracts);
  const fixedRentUf = calculateFixedRentUf(contracts);
  const fixedRentClp = buildFixedRentClpMetric(fixedRentUf, latestValorUf);
  const ggccUf = calculateEstimatedGgccUf(contracts);
  const contractStates = calculateContractStateCounters(
    groupedStates.map((item) => ({ estado: item.estado, cantidad: item._count._all }))
  );
  const expiringContracts = buildContractExpiryBuckets(contracts, today);

  const occupancyAccent =
    vacancy.totalVacantes > 0
      ? "red"
      : occupancy.porcentaje > 85
        ? "green"
        : occupancy.porcentaje >= 70
          ? "yellow"
          : "red";
  const vacancyAccent = vacancy.totalVacantes > 0 ? "red" : "green";

  const vacancySubtitle =
    vacancy.totalVacantes > 0 && vacancy.codigosPrimerosTres.length > 0
      ? `Primeros: ${vacancy.codigosPrimerosTres.join(", ")}`
      : "Sin locales vacantes";

  return (
    <main className="space-y-6">
      <header className="rounded-md bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="h-5 w-1 rounded-full bg-gold-400" />
              <h2 className="text-base font-bold uppercase tracking-wide text-brand-700">
                Control de gestion
              </h2>
            </div>
            <p className="text-sm text-slate-600">Indicadores clave del proyecto seleccionado.</p>
          </div>
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} preserve={{}} />
        </div>
      </header>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">Ocupación</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            title="Tasa de ocupación (%)"
            value={formatPercent(occupancy.porcentaje)}
            subtitle={`${occupancy.ocupados} de ${occupancy.totalActivos} locales`}
            accent={occupancyAccent}
          />
          <KpiCard
            title="GLA arrendada"
            value={formatSquareMeters(gla.glaArrendada)}
            subtitle={`de ${formatSquareMeters(gla.glaTotal)} totales`}
            accent="slate"
          />
          <KpiCard
            title="Locales vacantes"
            value={vacancy.totalVacantes.toString()}
            subtitle={vacancySubtitle}
            accent={vacancyAccent}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Renta mensual estimada
          </h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard title="Renta fija mensual (UF)" value={formatUf(fixedRentUf)} accent="slate" />
          <KpiCard
            title="Renta fija mensual (CLP)"
            value={fixedRentClp.value}
            subtitle={fixedRentClp.subtitle}
            accent="slate"
          />
          <KpiCard title="GGCC mensual estimado (UF)" value={formatUf(ggccUf)} accent="slate" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="mb-1 flex items-center gap-2">
          <div className="h-5 w-1 rounded-full bg-gold-400" />
          <h3 className="text-base font-bold uppercase tracking-wide text-brand-700">
            Cartera de contratos
          </h3>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {contractStates.counters.map((counter) => (
            <KpiCard
              key={counter.estado}
              title={counter.estado}
              value={counter.cantidad.toString()}
              subtitle={`${formatPercent(counter.porcentaje)} del total`}
              accent="slate"
            />
          ))}
        </div>
        <ContractExpiryTable rowsByWindow={expiringContracts} />
      </section>
    </main>
  );
}
